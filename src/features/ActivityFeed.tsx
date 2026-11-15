import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import RouteMap from '../RouteMap';
import { useSocial } from './Runtime';
import { socialRequest, type Activity } from './social';
import { Button, Empty, miles, s } from './ui';

function ActivityCard({ item, onChange }: { item: Activity; onChange: () => void }) {
  const { profile } = useSocial();
  const [mapOpen, setMapOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const points = item.route?.flatMap((line, segment) => line.map((p, i) => ({ ...p, timestamp: i, accuracy: 0, segment }))) ?? [];
  async function removePost() {
    try { await socialRequest('delete_post', { id: item.id.slice(5) }); onChange(); }
    catch (e) { setError(String(e)); }
  }
  return <View style={s.divider}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.display_name}'s profile`} onPress={() => router.push({ pathname: '/riders/[riderId]', params: { riderId: item.owner } })} style={s.row}>
      <View style={s.avatar}><Text style={s.label}>{item.display_name.slice(0, 2).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.label}>{item.display_name}</Text><Text style={s.small}>@{item.username}</Text></View>
      <Text style={s.small}>{item.kind === 'ride' ? item.ride_date : new Date(item.created_at).toLocaleDateString()}</Text>
    </Pressable>
    {item.kind === 'ride' ? <><Text style={s.section}>{miles(item.meters ?? 0)} mi ride</Text>
      {item.moving_seconds !== null && <Text style={s.body}>{Math.round(item.moving_seconds / 60)} min moving · {((item.average_speed ?? 0) * 2.236936).toFixed(1)} mph average · {((item.top_speed ?? 0) * 2.236936).toFixed(1)} mph top</Text>}{item.hidden && <Text style={s.small}>Hidden from other riders</Text>}
      {!!points.length && <Button title={mapOpen ? 'Close route' : 'View shared route'} secondary onPress={() => setMapOpen(!mapOpen)} />}
      {mapOpen && <View style={{ height: 200, overflow: 'hidden', borderRadius: 14 }}><RouteMap points={points} /></View>}
      {!points.length && <Text style={s.small}>{item.map_hidden ? 'Route map hidden' : 'No shareable route. Short rides and private areas stay hidden.'}</Text>}
    </> : <Text style={s.body}>{item.body}</Text>}
    {item.owner === profile?.id && item.kind === 'post' && <View style={s.row}><Button title={confirm ? 'Confirm delete post' : 'Delete post'} secondary onPress={() => confirm ? void removePost() : setConfirm(true)} />{confirm && <Button title="Cancel" secondary onPress={() => setConfirm(false)} />}</View>}
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
  </View>;
}

export default function ActivityFeed({ target }: { target?: string }) {
  const { profile } = useSocial();
  const [items, setItems] = useState<Activity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async (after?: Activity) => {
    const request = ++generation.current;
    setBusy(true);
    try {
      const data = await socialRequest<Activity[]>('feed', { target, before: after?.created_at, before_id: after?.id });
      if (request !== generation.current) return;
      setItems(current => after ? [...current, ...data.filter(item => !current.some(existing => existing.id === item.id))] : data);
      setMore(data.length === 20); setError('');
    } catch (e) { if (request === generation.current) { setError(String(e)); setItems([]); } }
    finally { if (request === generation.current) setBusy(false); }
  }, [target]);
  useFocusEffect(useCallback(() => {
    if (profile) void load();
    return () => { generation.current++; setItems([]); };
  }, [profile, load]));
  if (!profile) return null;
  return <View style={{ gap: 14 }}>
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
    {items.map(item => <ActivityCard key={item.id} item={item} onChange={() => void load()} />)}
    {!items.length && !busy && !error && <Empty icon="trail-sign-outline" title="The next ride starts here." detail={target ? 'Rides and posts will appear here.' : 'Add friends or follow riders to see their rides and posts.'} />}
    <Button title={busy ? 'Loading activity…' : 'Refresh activity'} secondary disabled={busy} onPress={() => void load()} />
    {more && <Button title="More activity" secondary disabled={busy} onPress={() => void load(items.at(-1))} />}
  </View>;
}
