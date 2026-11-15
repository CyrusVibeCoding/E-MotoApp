import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RouteMap from '../RouteMap';
import GroupPanel from '../GroupPanel';
import { duration } from '../ride';
import { useGroup, useRide, useSocial } from './Runtime';
import { socialRequest, type FriendLocation } from './social';
import { Button, colors, Heading, miles, s } from './ui';

export default function HomeScreen() {
  const ride = useRide();
  const group = useGroup();
  const social = useSocial();
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [friendError, setFriendError] = useState('');
  useFocusEffect(useCallback(() => {
    let live = true;
    const load = async () => {
      if (!social.profile) return;
      try { const value = await socialRequest<FriendLocation[]>('locations'); if (live) { setFriends(value); setFriendError(''); } }
      catch { if (live) { setFriends([]); setFriendError('Friend locations are waiting for a connection.'); } }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { live = false; clearInterval(timer); setFriends([]); };
  }, [social.profile]));
  async function finish() {
    const saved = await ride.finish();
    if (saved) router.push({ pathname: '/rides/[rideId]', params: { rideId: saved.id } });
  }
  const active = ride.data.draft;
  const liveFriends = friends.filter(friend => Date.parse(friend.expires_at) > ride.now && ride.now - Date.parse(friend.observed_at) < 20000);
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16 }}><Heading title="Home" detail="Find your crew. Take the long way." /></View>
    <View style={{ flex: 1, minHeight: 220, backgroundColor: colors.soft }}>
      <RouteMap points={active?.points ?? []} location={ride.fix} group={group.group} connected={group.connected} serverNow={group.serverNow} friends={liveFriends} onFriendPress={id => router.push({ pathname: '/riders/[riderId]', params: { riderId: id } })} />
    </View>
    <ScrollView style={{ flexGrow: 0, maxHeight: '55%' }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingTop: 18 }]}>
      {!ride.ready && <ActivityIndicator color={colors.accent} />}
      <View style={s.row}><Ionicons name={active ? 'radio-button-on' : 'navigate-outline'} size={20} color={colors.accent} /><Text accessibilityLiveRegion="polite" style={[s.label, { flex: 1 }]}>{active ? `Recording · ${ride.status}` : ride.status}</Text></View>
      {active ? <><View style={s.stats}><View><Text style={s.number}>{miles(active.meters)} mi</Text><Text style={s.small}>Recorded distance</Text></View><View><Text style={s.number}>{duration((ride.now - active.startedAt) / 1000)}</Text><Text style={s.small}>Elapsed time</Text></View></View><Button title={ride.busy ? 'Saving…' : 'Finish ride'} onPress={() => void finish()} disabled={ride.busy} /></> : <Button title={ride.busy ? 'Starting…' : 'Start solo ride'} onPress={() => void ride.start()} disabled={!ride.canStart || Platform.OS === 'web'} />}
      {ride.status !== 'GPS ready' && <Button title={ride.permissionBlocked ? 'Open location settings' : 'Retry location'} secondary onPress={() => ride.permissionBlocked ? void Linking.openSettings() : void ride.locate()} />}
      <Text style={s.small}>{ride.background ? 'Background location enabled. Updates depend on GPS and system availability.' : 'Foreground tracking. Keep RepRide open during your Expo Go ride.'}</Text>
      <GroupPanel ride={group} />
      <View style={s.divider}><Text style={s.section}>Friends on the map</Text><Text style={s.body}>{liveFriends.length ? `${liveFriends.length} ${liveFriends.length === 1 ? 'friend is' : 'friends are'} sharing a live location.` : 'Friends appear here when they choose to share their location.'}</Text>
        <Button title={ride.friendsUntil > ride.now ? 'Stop sharing with friends' : 'Share with friends for 15 min'} secondary disabled={ride.busy || (Platform.OS === 'web' && ride.friendsUntil <= ride.now)} onPress={() => {
          if (!social.profile) { router.navigate('/profile'); return; }
          void ride.shareWithFriends(ride.friendsUntil <= ride.now);
        }} />
        <Text style={s.small}>Accepted friends only. Privacy zones hide your position. Sharing stops after 15 minutes. Last shared positions expire within 30 seconds offline.</Text>
        {!!(ride.friendMessage || friendError) && <Text accessibilityLiveRegion="polite" style={s.body}>{ride.friendMessage || friendError}</Text>}
      </View>
    </ScrollView>
  </View>;
}
