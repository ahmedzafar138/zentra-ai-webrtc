import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart3, UtensilsCrossed, Footprints } from 'lucide-react-native';
import { theme } from '@/constants/theme';

export default function HistoryScreen() {
  const router = useRouter();

  const historyOptions = [
    {
      icon: BarChart3,
      title: 'Logs History',
      subtitle: 'View your workout history',
      onPress: () => router.push('/history/logs'),
    },
    {
      icon: UtensilsCrossed,
      title: 'Meal History',
      subtitle: 'View your saved meal plans',
      onPress: () => router.push('/history/meals'),
    },
    {
      icon: Footprints,
      title: 'Steps History',
      subtitle: 'View your step tracking history',
      onPress: () => router.push('/history/steps'),
    },
  ];

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Track your fitness journey</Text>
<ScrollView>
          <View style={styles.optionsContainer}>
            {historyOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionCard}
                onPress={option.onPress}
                activeOpacity={0.8}
              >
                <View style={styles.iconContainer}>
                  <option.icon size={32} color={theme.colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
  </ScrollView>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 20,
    paddingBottom: 25
  },
  optionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.default,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
  },
  optionSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
});
