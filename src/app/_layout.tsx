import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Runtime } from '../features/Runtime';
import { colors } from '../features/ui';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Barlow: require('../../assets/fonts/BarlowCondensed.ttf'),
    DM: require('../../assets/fonts/DMSans400.ttf'),
    DMBold: require('../../assets/fonts/DMSans700.ttf'),
  });
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.accent} /><Text>Opening RepRide…</Text></View>;
  return <SafeAreaProvider><Runtime><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} /></Runtime></SafeAreaProvider>;
}
