import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatbotService, type ChatOption } from '../services/chatbotService';

type ChatEntry = {
  from: 'bot' | 'user';
  text: string;
  options?: ChatOption[];
};

interface ChatScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChatScreen({ visible, onClose }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const openChat = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatbotService.open();
      setMessages([{ from: 'bot', text: res.message, options: res.options }]);
    } catch {
      setMessages([{ from: 'bot', text: 'Could not connect. Try again shortly.' }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && messages.length === 0) {
      const t = setTimeout(() => {
        void openChat();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [visible, messages.length, openChat]);

  async function selectOption(option: ChatOption) {
    setMessages((prev) => [...prev, { from: 'user', text: option.label }]);
    setLoading(true);
    try {
      const res = await chatbotService.respond({ intentKey: option.nextIntentKey });
      setMessages((prev) => [...prev, { from: 'bot', text: res.message, options: res.options }]);
    } catch {
      setMessages((prev) => [...prev, { from: 'bot', text: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>WelliRecord Assistant</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
          {messages.map((entry, i) => (
            <View key={i} style={[styles.bubble, entry.from === 'bot' ? styles.botBubble : styles.userBubble]}>
              <Text style={entry.from === 'bot' ? styles.botText : styles.userText}>{entry.text}</Text>
              {entry.options && entry.options.length > 0 && (
                <View style={styles.optionsRow}>
                  {entry.options.map((opt) => (
                    <TouchableOpacity
                      key={opt.nextIntentKey}
                      style={styles.optionButton}
                      onPress={() => selectOption(opt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.optionText}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
          {loading && <ActivityIndicator style={{ marginTop: 8 }} color="#0a7" />}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0B2545' },
  closeText: { color: '#0a7', fontSize: 14, fontWeight: '600' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 12 },
  botBubble: { backgroundColor: '#f2f2f2', alignSelf: 'flex-start' },
  userBubble: { backgroundColor: '#0a7', alignSelf: 'flex-end' },
  botText: { color: '#111', fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  optionsRow: { marginTop: 8, gap: 8 },
  optionButton: {
    borderWidth: 1,
    borderColor: '#0a7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f6fffa',
  },
  optionText: { color: '#0a7', fontSize: 13, fontWeight: '500' },
});
