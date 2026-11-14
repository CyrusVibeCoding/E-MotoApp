import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RepRide',
  slug: config.slug ?? 'emoto',
  scheme: 'repride',
  plugins: [...(config.plugins ?? []), 'expo-router', ['react-native-maps', {
    androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
  }]],
});
