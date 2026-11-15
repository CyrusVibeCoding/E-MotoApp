import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGroupRide } from './useGroupRide';
import { memberStatus } from './groupModel';
type Props = { ride: ReturnType<typeof useGroupRide> };
export default function GroupPanel({ ride }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  function action(title: string, onPress: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, disabled && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}><Text style={s.actionText}>{title}</Text></Pressable>;
  }
  return <View style={s.root}>
    <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={s.heading}>
      <Ionicons name="people-outline" size={22} color="#171717" /><Text style={s.title}>{ride.group ? `Group ${ride.group.code}` : 'Ride together'}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
    </Pressable>
    {ride.group && <Text accessibilityLiveRegion="polite" style={s.body}>{ride.sharing ? 'Sharing with this group only' : 'Location sharing interrupted. Positions are last known.'}</Text>}
    {!!ride.message && <Text accessibilityLiveRegion="polite" style={s.body}>{ride.message}</Text>}
    {ride.group ? <>
      {expanded && <><Text selectable style={s.code}>{ride.group.code}</Text><Text style={s.body}>Invite trusted riders only. The code grants access to this group. Ends {new Date(ride.group.expires_at).toLocaleString()}.</Text>
        {ride.group.members.map(member => <View key={member.id} style={s.member}><Text style={s.name}>{member.name}{member.id === ride.group?.self_id ? ' (you)' : ''}</Text><Text style={s.body}>{memberStatus(member, ride.serverNow, ride.connected)}{member.observed_at ? ` - Updated ${new Date(member.observed_at).toLocaleTimeString()}` : ''}</Text></View>)}
      </>}
      {action('Leave group and stop sharing', () => void ride.leave())}
    </> : expanded && <>
      {!ride.configured ? <Text style={s.body}>Group rides need a Supabase project connection. Follow GROUP-RIDES.md to enable them. Your local ride recorder still works.</Text> : <>
        <Text style={s.label}>Display name</Text><TextInput accessibilityLabel="Group display name" maxLength={32} value={name} onChangeText={setName} placeholder="Your riding name" placeholderTextColor="#606060" style={s.input} />
        <Pressable accessibilityRole="checkbox" aria-checked={consent} accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={s.consent}><Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} /><Text style={[s.body, { flex: 1 }]}>Share my location with members of this group including while the screen is locked, when background permission is granted. Leaving stops uploads. Last-known positions can remain for up to 90 seconds offline.</Text></Pressable>
        {action(ride.busy ? 'Connecting...' : 'Create group', () => void ride.enter('create', name), ride.busy || !consent)}
        <Text style={s.label}>Invite code</Text><TextInput accessibilityLabel="Group invite code" maxLength={8} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="8-character code" placeholderTextColor="#606060" style={s.input} />
        {action(ride.busy ? 'Connecting...' : 'Join group', () => void ride.enter('join', name, code), ride.busy || !consent)}
      </>}
    </>}
  </View>;
}
const s = StyleSheet.create({ root: { gap: 12, borderTopWidth: 1, borderColor: '#dedede', paddingTop: 16 }, heading: { flexDirection: 'row', gap: 10, minHeight: 48, alignItems: 'center' }, title: { flex: 1, fontSize: 20, fontWeight: '600', color: '#171717' }, body: { fontSize: 14, lineHeight: 21, color: '#606060' }, label: { fontSize: 15, fontWeight: '500', color: '#171717' }, name: { fontSize: 16, fontWeight: '600', color: '#171717' }, code: { fontSize: 28, fontWeight: '600', letterSpacing: 2, color: '#171717' }, input: { minHeight: 52, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#dedede', fontSize: 16, color: '#171717' }, action: { minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: '#171717', justifyContent: 'center', alignItems: 'center' }, actionText: { color: '#fff', fontSize: 16, fontWeight: '600' }, consent: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10 }, member: { paddingVertical: 8, gap: 4 } });
