import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRide, useGroup, useLocal } from '../../features/Runtime';
import { Button, colors, s } from '../../features/ui';

function RideStatus() {
  const ride = useRide();
  const group = useGroup();
  const local = useLocal();
  return <>
    {(ride.data.draft || group.group) && <Pressable accessibilityRole="button" accessibilityLabel="Return to active ride" onPress={() => router.navigate('/')} style={t.active}>
      <Ionicons name="radio-button-on" size={16} color={colors.ink} /><Text style={s.label}>{ride.data.draft ? 'Recording in progress' : `Group ${group.group?.code}`}</Text><Ionicons name="arrow-forward" size={18} color={colors.ink} />
    </Pressable>}
    {!!(ride.storageError || local.error) && <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{ride.storageError || local.error}</Text><Button title="Retry saved data" onPress={() => { void ride.retrySave(); void local.save(value => value); }} secondary /></View>}
  </>;
}
const icons = { index: 'map-outline', friends: 'people-outline', garage: 'bicycle-outline', profile: 'person-outline' } as const;
export default function TabLayout() {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'left', 'right']}>
    <RideStatus />
    <Tabs screenOptions={({ route }) => ({
      headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, minHeight: 72, paddingTop: 8 },
      tabBarLabelStyle: { fontFamily: 'DMBold', fontSize: 11, marginTop: 4 },
      sceneStyle: { backgroundColor: '#fff' },
      tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name as keyof typeof icons]} color={typeof color === 'string' ? color : colors.muted} size={size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarAccessibilityLabel: 'Friends' }} />
      <Tabs.Screen name="garage" options={{ title: 'Garage', tabBarAccessibilityLabel: 'Garage' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile' }} />
    </Tabs>
  </SafeAreaView>;
}
const t = StyleSheet.create({ active: { backgroundColor: colors.blue, paddingHorizontal: 20, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 } });
