import Constants from 'expo-constants';
import { Platform } from 'react-native';

const configuredBaseUrl =
  Constants.expoConfig?.extra?.modelGatewayApiBaseUrl ??
  process.env.EXPO_PUBLIC_MODEL_GATEWAY_API_BASE_URL;

function normalizeLocalBaseUrl(url: string) {
  const trimmedUrl = url.trim().replace(/\/$/, '');
  const localHttpOnlyHosts = ['localhost', '127.0.0.1', '10.0.2.2'];

  if (
    trimmedUrl.startsWith('https://') &&
    localHttpOnlyHosts.some((host) => trimmedUrl.includes(`://${host}`))
  ) {
    return trimmedUrl.replace('https://', 'http://');
  }

  return trimmedUrl;
}

function inferDevelopmentBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:8010`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8010';
  }

  return 'http://localhost:8010';
}

export function getModelGatewayCandidateBaseUrls() {
  const candidates = [
    inferDevelopmentBaseUrl(),
    configuredBaseUrl,
    Platform.OS === 'android' ? 'http://10.0.2.2:8010' : undefined,
    'http://localhost:8010',
    'http://127.0.0.1:8010',
  ]
    .filter(Boolean)
    .map((url) => normalizeLocalBaseUrl(url as string));

  return Array.from(new Set(candidates));
}
