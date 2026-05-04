import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { hasCompletedBodyMetrics } from '@/lib/bodyMetrics';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const routeAfterSplash = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!active) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace('/onboarding');
          return;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('height_cm, weight_kg, onboarding_completed')
          .eq('id', session.user.id)
          .maybeSingle();

        router.replace(hasCompletedBodyMetrics(profile) ? '/(tabs)' : '/body-metrics');
      } catch (error) {
        console.error('Error checking session:', error);
        router.replace('/onboarding');
      }
    };

    routeAfterSplash();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>Zentra</Text>
        <Text style={styles.subtitle}>AI Fitness Trainer</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.info,
    fontWeight: '500',
  },
});
