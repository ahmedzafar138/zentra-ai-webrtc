import { Stack } from 'expo-router/stack';

export default function HistoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="logs" />
      <Stack.Screen name="meals" />
      <Stack.Screen name="steps" />
    </Stack>
  );
}
