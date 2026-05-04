import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send } from 'lucide-react-native';
import { theme } from '@/constants/theme';

export default function ZentraAIQueryScreen() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSend = () => {
    if (query.trim()) {
      router.push({
        pathname: '/zentra-ai/chat',
        params: { initialQuery: query },
      });
    }
  };

  const quickPrompts = [
    'How do I lose belly fat?',
    'Best exercises for biceps',
    'How much creatine should I take?',
  ];

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <X size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}> 
          <Text style={styles.logo}>Zentra AI</Text>
          <Text style={styles.subtitle}>Got any questions? Ask away</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Ask me anything about fitness..."
              placeholderTextColor={theme.colors.inactive}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !query.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!query.trim()}
            >
              <Send size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.quickPrompts}>
            <Text style={styles.quickPromptsLabel}>Quick prompts:</Text>
            {quickPrompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.promptChip}
                onPress={() => setQuery(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.secondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  quickPrompts: {
    gap: 12,
  },
  quickPromptsLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    marginBottom: 8,
  },
  promptChip: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.inactive,
  },
  promptText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
  },
});
