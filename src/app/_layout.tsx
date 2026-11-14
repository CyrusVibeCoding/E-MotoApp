import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

void SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [loaded, error] = useFonts({
    BarlowCondensed: require('../../assets/fonts/BarlowCondensed.ttf'),
    DMSans: require('../../assets/fonts/DMSans400.ttf'),
    DMSansMedium: require('../../assets/fonts/DMSans500.ttf'),
    DMSansBold: require('../../assets/fonts/DMSans700.ttf'),
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }} /></>;
}
