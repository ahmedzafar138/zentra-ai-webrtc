import Constants from 'expo-constants';
import { Platform } from 'react-native';

const configuredBaseUrl =
  Constants.expoConfig?.extra?.ragApiBaseUrl ??
  process.env.EXPO_PUBLIC_RAG_API_BASE_URL;

function inferDevelopmentBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:8001`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8001';
  }

  return 'http://localhost:8001';
}

export const RAG_API_BASE_URL = configuredBaseUrl ?? inferDevelopmentBaseUrl();

export async function askRag(question: string): Promise<string> {
  const response = await fetch(`${RAG_API_BASE_URL}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail ?? 'Unable to reach Zentra AI right now.';
    throw new Error(message);
  }

  if (!data?.answer) {
    throw new Error('Zentra AI returned an empty answer.');
  }

  return data.answer;
}
