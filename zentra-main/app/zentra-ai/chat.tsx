import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { askRag } from '@/lib/ragApi';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();

  // Initial query handling
  useEffect(() => {
    if (params.initialQuery) handleSend(params.initialQuery as string);
  }, [params.initialQuery]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const answer = await askRag(messageText);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          error instanceof Error
            ? error.message
            : 'Unable to reach Zentra AI right now.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Scroll to bottom after new messages
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  return (
    <LinearGradient colors={[theme.colors.background, '#0A0A0A']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={24} color={theme.colors.white} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Zentra AI</Text>
              <Text style={styles.headerSubtitle}>Got any questions? Ask away</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* CHAT CONTENT */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
          >
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Start a conversation with Zentra AI</Text>
              </View>
            )}

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={[styles.messageText, message.role === 'user' && styles.userText]}>
                  {message.content}
                </Text>
                <Text style={styles.timestamp}>
                  {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* INPUT BOX */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type your message..."
              placeholderTextColor={theme.colors.inactive}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSend()}
              disabled={!input.trim()}
            >
              <Send size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16, 
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card,
  },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.white },
  headerSubtitle: { fontSize: theme.fontSize.xs, color: theme.colors.secondary },

  messages: { flex: 1 },
  messagesContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: theme.fontSize.md, color: theme.colors.secondary },

  messageBubble: {
    maxWidth: '80%',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.card },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.inactive },

  messageText: { fontSize: theme.fontSize.md, color: theme.colors.white, lineHeight: 22, marginBottom: 4 },
  userText: { color: theme.colors.white },
  timestamp: { fontSize: 10, color: theme.colors.inactive, alignSelf: 'flex-end' },

  typingIndicator: { flexDirection: 'row', gap: 6 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.secondary },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    gap: 12,
  },
  input: { flex: 1, color: theme.colors.white, fontSize: theme.fontSize.md, maxHeight: 100, paddingTop: 12 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
