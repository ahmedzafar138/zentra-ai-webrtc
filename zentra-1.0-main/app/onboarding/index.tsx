import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, CheckCircle, ChefHat, MessageCircle, Newspaper, TrendingUp, Footprints } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import ProgressDots from '@/components/ProgressDots';

const onboardingData = [
  {
    icon: Dumbbell,
    title: 'Zentra',
    description: 'Ready to transform your body?',
    buttonText: 'Get Started',
  },
  {
    icon: CheckCircle,
    title: 'Form correction',
    description: 'So accurate you\'ll NEVER need a trainer.',
    buttonText: 'Next',
  },
  {
    icon: ChefHat,
    title: 'Smart meal plans',
    description: 'Generate recipes at a tap—personalized by AI.',
    buttonText: 'Next',
  },
  {
    icon: MessageCircle,
    title: 'Ask anything',
    description: 'An AI‑assisted coach for all your fitness questions.',
    buttonText: 'Next',
  },
  {
    icon: Newspaper,
    title: 'Stay updated',
    description: 'Expert blogs to keep up with the latest fitness trends.',
    buttonText: 'Next',
  },
  {
    icon: TrendingUp,
    title: 'Track progress',
    description: 'Visualize your workouts and celebrate wins.',
    buttonText: 'Next',
  },
  {
    icon: Footprints,
    title: 'Walk it off',
    description: 'Built‑in step counter to burn that stubborn belly fat.',
    buttonText: 'Let\'s start!',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/auth');
    }
  };

  const handleSkip = () => {
    router.replace('/auth');
  };

  const currentScreen = onboardingData[currentIndex];
  const IconComponent = currentScreen.icon;

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {currentIndex < onboardingData.length - 1 && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <IconComponent size={80} color={theme.colors.primary} strokeWidth={1.5} />
          </View>

          <Text style={styles.title}>{currentScreen.title}</Text>
          <Text style={styles.description}>{currentScreen.description}</Text>

          <ProgressDots total={onboardingData.length} current={currentIndex} />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title={currentScreen.buttonText}
            onPress={handleNext}
          />
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
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  skipText: {
    color: theme.colors.secondary,
    fontSize: theme.fontSize.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  footer: {
    paddingBottom: 24,
  },
});
