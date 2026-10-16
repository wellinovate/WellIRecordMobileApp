import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { chatbotService, type ChatOption } from "../services/chatbotService";
import type { WelliApp } from "../state/useWelliApp";

type ChatEntry = {
  from: "bot" | "user";
  text: string;
  options?: ChatOption[];
};

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
  const scrollRef = useRef<ScrollView>(null);

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

  const goBack = () => {
    if (state.tabHistory.length > 0) {
      actions.goBackTab();
      return;
    }

    actions.setTab("home");
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        ref={scrollRef}
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

          <View className="h-9 w-9" />
        </View>

        <Text className="mt-3 text-[11px] font-semibold text-[#315B90]">
          WelliRecord · Assistant
        </Text>

        <Text className="mt-3 text-[28px] leading-[34px] font-extrabold text-[#082F67]">
          Health record assistant
        </Text>

        <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
          Get help using WelliRecord, understanding app tasks, and finding the
          right place to manage your information.
        </Text>

        <View className="mt-5 rounded-2xl bg-[#EEF3FA] p-4">
          <Text className="text-[12px] leading-[18px] text-[#536A84]">
            The Assistant can help with app tasks and record navigation. It
            does not replace a healthcare professional or emergency service.
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
              <Text
                className={`text-[13px] leading-[19px] ${
                  entry.from === "bot"
                    ? "text-[#173B68]"
                    : "text-white"
                }`}
              >
                {entry.text}
              </Text>

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
      </ScrollView>
    </View>
  );
}
