import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  AssistantUnavailableError,
  chatbotService,
  type AssistantTurn,
  type ChatOption,
} from "../services/chatbotService";
import type { WelliApp } from "../state/useWelliApp";

type ChatEntry = {
  from: "bot" | "user";
  text: string;
  options?: ChatOption[];
  notice?: string;
  failed?: boolean;
};

const MAX_INPUT = 1000;
const EXAMPLES = [
  "How do I share records with my doctor?",
  "How do I add my child?",
  "What is the Emergency ID?",
];

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#172033"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ChatScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<View>(null);
  // Android draws under the keyboard (edge to edge), so the box is lifted by however much the keyboard overlaps it.
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      boxRef.current?.measureInWindow((_x, y, _w, h) => {
        setLift(Math.max(0, Math.round(y + h - e.endCoordinates.screenY)));
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const openChat = useCallback(async () => {
    setLoading(true);

    try {
      const response = await chatbotService.open();

      setMessages([
        {
          from: "bot",
          text: response.message,
          options: response.options,
        },
      ]);
    } catch {
      setMessages([
        {
          from: "bot",
          text: "Could not connect to the Assistant. Try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      void openChat();
    }
  }, [messages.length, openChat]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, loading]);

  const selectOption = async (option: ChatOption) => {
    setMessages((current) => [
      ...current,
      { from: "user", text: option.label },
    ]);

    setLoading(true);

    try {
      const response = await chatbotService.respond({
        intentKey: option.nextIntentKey,
      });

      setMessages((current) => [
        ...current,
        {
          from: "bot",
          text: response.message,
          options: response.options,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          from: "bot",
          text: "Something went wrong. Try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim().slice(0, MAX_INPUT);
    if (!text || sending) return;

    // The conversation so far, as plain turns for the Assistant.
    const history: AssistantTurn[] = [
      ...messages
        .filter((m) => m.text && !m.failed)
        .map((m) => ({
          role: m.from === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
      { role: "user", content: text },
    ];

    setInput("");
    setSending(true);
    setMessages((current) => [
      ...current.map((m) => ({ ...m, options: undefined })),
      { from: "user", text },
      { from: "bot", text: "" },
    ]);

    const patchLast = (fn: (e: ChatEntry) => ChatEntry) =>
      setMessages((current) =>
        current.length ? [...current.slice(0, -1), fn(current[current.length - 1])] : current,
      );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await chatbotService.ask(
        history,
        {
          onNotice: (notice) => patchLast((e) => ({ ...e, notice })),
          onDelta: (piece) => patchLast((e) => ({ ...e, text: e.text + piece })),
        },
        controller.signal,
      );
    } catch (error: any) {
      if (controller.signal.aborted) return;
      const unavailable = error instanceof AssistantUnavailableError;
      patchLast((e) => ({
        ...e,
        text: e.text
          ? `${e.text}\n\n(The answer was cut off. Ask again to continue.)`
          : unavailable
            ? "The live Assistant is not switched on yet. Pick one of the quick questions in the menu above."
            : error?.message || "Something went wrong. Try again.",
        failed: !e.text,
      }));
    } finally {
      setSending(false);
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setSending(false);
    setInput("");
    setMessages([]);
  };

  const goBack = () => {
    if (state.tabHistory.length > 0) {
      actions.goBackTab();
      return;
    }

    actions.setTab("home");
  };

  return (
    <View ref={boxRef} collapsable={false} className="flex-1 bg-white">
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      style={{ paddingBottom: lift }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="min-h-[44px] flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.72}
            onPress={goBack}
            className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"
          >
            <BackIcon />
          </TouchableOpacity>

          <Text className="text-[12px] font-semibold text-slate-800">
            WelliRecord<Text className="text-[7px]">™</Text>
          </Text>

          <TouchableOpacity
            activeOpacity={0.72}
            onPress={newChat}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            className="h-9 items-center justify-center rounded-full bg-slate-50 px-3"
          >
            <Text className="text-[11px] font-semibold text-[#315B90]">New chat</Text>
          </TouchableOpacity>
        </View>

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
          WelliRecord · Assistant
        </Text>

        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
          Health record assistant
        </Text>

        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
          Ask anything about using WelliRecord, your records, sharing, family
          profiles and care. Answers appear as they are written.
        </Text>

        <View className="mt-5 rounded-2xl bg-[#EEF3FA] p-4">
          <Text className="text-[12px] leading-[18px] text-[#536A84]">
            The Assistant cannot see your records. Do not type ID numbers,
            passwords or codes. It does not replace a healthcare professional.
            In an emergency, call 112.
          </Text>
        </View>

        <View className="mt-5 gap-3">
          {messages.map((entry, index) => (
            <View
              key={`${entry.from}-${index}`}
              className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                entry.from === "bot"
                  ? "self-start bg-[#F1F4F8]"
                  : "self-end bg-[#082F67]"
              }`}
            >
              {entry.notice ? (
                <View className="mb-2 rounded-xl bg-[#FEE2E2] px-3 py-2">
                  <Text className="text-[12px] font-semibold leading-[18px] text-[#991B1B]">
                    {entry.notice}
                  </Text>
                </View>
              ) : null}

              {entry.from === "bot" && !entry.text && sending && index === messages.length - 1 ? (
                <ActivityIndicator size="small" color="#315B90" />
              ) : (
                <Text
                  selectable
                  className={`text-[13px] leading-[19px] ${
                    entry.from === "bot"
                      ? "text-[#173B68]"
                      : "text-white"
                  }`}
                >
                  {entry.text}
                </Text>
              )}

              {entry.options?.length ? (
                <View className="mt-3 gap-2">
                  {entry.options.map((option) => (
                    <TouchableOpacity
                      key={option.nextIntentKey}
                      activeOpacity={0.78}
                      onPress={() => void selectOption(option)}
                      className="min-h-[44px] justify-center rounded-xl border border-[#B9CAE0] bg-white px-3"
                    >
                      <Text className="text-[12px] font-semibold text-[#315B90]">
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          {loading ? (
            <View className="self-start rounded-2xl bg-[#F1F4F8] px-4 py-3">
              <ActivityIndicator size="small" color="#315B90" />
            </View>
          ) : null}
        </View>

        {messages.length <= 1 ? (
          <View className="mt-5 gap-2">
            <Text className="text-[11px] font-semibold text-slate-500">Try asking</Text>
            {EXAMPLES.map((q) => (
              <TouchableOpacity
                key={q}
                activeOpacity={0.78}
                onPress={() => void send(q)}
                className="min-h-[44px] justify-center rounded-xl border border-[#B9CAE0] bg-white px-3"
              >
                <Text className="text-[12px] font-semibold text-[#315B90]">{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="flex-row items-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question"
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={MAX_INPUT}
          editable={!sending}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => void send()}
          accessibilityLabel="Ask the Assistant"
          className="max-h-[110px] min-h-[44px] flex-1 rounded-2xl border border-[#B9CAE0] bg-white px-4 py-2 text-[14px] text-[#173B68]"
        />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => void send()}
          disabled={sending || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={`h-11 items-center justify-center rounded-2xl px-5 ${
            sending || !input.trim() ? "bg-[#9FB4D0]" : "bg-[#082F67]"
          }`}
        >
          <Text className="text-[13px] font-bold text-white">Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}
