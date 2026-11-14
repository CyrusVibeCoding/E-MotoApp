import type { FriendLocation } from './features/social';
import React from 'react';
import { View, Text } from 'react-native';
import type { GroupSession } from './groupModel';
import { Point } from './ride';
export default function RouteMap(_: { points: Point[]; location?: Point | null; group?: GroupSession | null; connected?: boolean; serverNow?: number; friends?: FriendLocation[]; onFriendPress?: (id: string) => void }) {
  return <View style={{ flex: 1, backgroundColor: '#ededed', alignItems: 'center', justifyContent: 'center', padding: 32 }}><Text style={{ fontSize: 20, fontWeight: '600' }}>Your map lives on your phone.</Text><Text style={{ color: '#606060', textAlign: 'center', marginTop: 12 }}>Open in Expo Go for the native map and route preview. Web is a layout preview only.</Text></View>;
}
