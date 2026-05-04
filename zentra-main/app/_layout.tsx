import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar'; 
import { theme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync(); // keep splash until ready

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // simulate async tasks: fonts, theme, data etc
        await new Promise(resolve => setTimeout(resolve, 300));
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!appReady) {
    // Keep the splash screen visible
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="body-metrics" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </View>
  );
}
