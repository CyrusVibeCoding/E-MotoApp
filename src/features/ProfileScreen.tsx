import React, { useCallback, useRef, useState } from 'react';

import { Pressable, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { SafeAreaView } from 'react-native-safe-area-context';

import { duration } from '../ride';

import { useLocal, useRide, useSocial } from './Runtime';

import { socialRequest, type Rider } from './social';

import BikeViewer from './BikeViewer';

import ActivityFeed from './ActivityFeed';

import { Button, colors, Empty, Field, Heading, miles, Page, s } from './ui';



function ProfileEditor() {

  const social = useSocial();

  const ride = useRide();

  const { local, save } = useLocal();

  const [username, setUsername] = useState(social.profile?.username ?? '');

  const [name, setName] = useState(social.profile?.display_name ?? '');

  const [bio, setBio] = useState(social.profile?.bio ?? '');

  const [visibility, setVisibility] = useState<'private' | 'public'>(social.profile?.visibility ?? 'private');

  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState('');

  async function submit() {

    if (!local) return;

    setBusy(true);

    try {

      await socialRequest('save_profile', { username: username.toLowerCase().trim(), display_name: name.trim(), bio: bio.trim(), visibility,

        build: { ...ride.data.bike, mods: local.mods, color: local.color } });

      await save(value => ({ ...value, publicationStart: value.publicationStart ?? Date.now() }));

      await social.refresh(); setMessage('Rider profile saved. Future completed rides share automatically.');

    } catch (e) { setMessage(String(e)); }

    finally { setBusy(false); }

  }

  return <View style={s.divider}>

    <Text style={s.section}>{social.profile ? 'Edit rider profile' : 'Your rider identity'}</Text>

    <Field label="Rider name" value={name} onChangeText={setName} maxLength={48} placeholder="Your riding name" />

    <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={24} placeholder="3–24 letters, numbers, underscores" />

    <Field label="Bio" value={bio} onChangeText={setBio} maxLength={240} multiline placeholder="A little about your rides" />

    <Pressable accessibilityRole="switch" accessibilityLabel="Public profile" aria-checked={visibility === 'public'} accessibilityState={{ checked: visibility === 'public' }} onPress={() => setVisibility(visibility === 'public' ? 'private' : 'public')} style={s.row}><Ionicons name={visibility === 'public' ? 'toggle' : 'toggle-outline'} size={36} color={colors.accent} /><View style={{ flex: 1 }}><Text style={s.label}>{visibility === 'public' ? 'Public profile' : 'Private profile'}</Text><Text style={s.small}>{visibility === 'public' ? 'Rides and posts are public.' : 'Rides and posts are visible to accepted friends.'}</Text></View></Pressable>

    <Button title={busy ? 'Saving profile…' : 'Save rider profile'} onPress={() => void submit()} disabled={busy || !social.configured || !local || !name.trim() || !/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())} />

    {!social.configured && <Text style={s.body}>The rider service needs a backend connection. Your local profile, bike, and rides remain available.</Text>}

    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}

  </View>;

}



function SharingSettings() {

  const ride = useRide();

  const social = useSocial();

  const { local, save } = useLocal();

  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);

  const [importConfirm, setImportConfirm] = useState(false);

  async function addZone() {

    if (!ride.fix || ride.status !== 'GPS ready' || !local) return;

    setBusy(true);

    try {

      // Remove already-published maps before a new zone can become active.

      const revision = social.profile ? await socialRequest<{ revision: number }>('clear_routes') : { revision: local.privacyRevision };

      const fix = ride.fix;

      const saved = await save(value => ({ ...value, privacyRevision: revision.revision, zones: [...value.zones, { id: String(Date.now()), latitude: fix.latitude, longitude: fix.longitude, radius: 500 }] }));

      if (saved) setMessage('500 m privacy zone added. Previously shared route maps have been removed.');

    } catch (e) { setMessage(String(e)); }

    finally { setBusy(false); }

  }

  return <View style={s.divider}>

    <Text style={s.section}>Sharing & privacy</Text>

    <Text style={s.body}>Shared rides show distance and date. Routes hide the first and last 500 m and your privacy zones. Exact departure times, addresses, and private GPS points stay on this device.</Text>

    <Text style={s.small}>New rides capture GPS-estimated moving time and speed. Earlier rides keep unavailable measurements. Wheelie measurement is pending.</Text>

    <Text style={s.label}>Privacy zones · {local?.zones.length ?? 0}</Text>

    <Text style={s.body}>Protect home or school by adding a 500 m zone around your current location. Friend location sharing is suppressed inside these zones.</Text>

    <Button title="Protect my current location" secondary disabled={busy || !local || !ride.fix || ride.status !== 'GPS ready'} onPress={() => void addZone()} />

    {local?.zones.map((zone, index) => <View key={zone.id} style={s.row}><Text style={[s.body, { flex: 1 }]}>Privacy zone {index + 1} · {zone.radius} m</Text><Button title={`Remove zone ${index + 1}`} secondary onPress={() => void save(value => ({ ...value, zones: value.zones.filter(item => item.id !== zone.id) }))} /></View>)}

    <Text style={s.small}>Leaderboards have a separate opt-in. Leaderboard results are planned.</Text>

    <Pressable accessibilityRole="switch" accessibilityLabel="Leaderboard participation" aria-checked={local?.leaderboardOptIn ?? false} accessibilityState={{ checked: local?.leaderboardOptIn ?? false }} disabled={!local} onPress={() => void save(value => ({ ...value, leaderboardOptIn: !value.leaderboardOptIn }))} style={s.row}><Ionicons name={local?.leaderboardOptIn ? 'checkbox' : 'square-outline'} size={26} color={colors.accent} /><Text style={s.body}>Opt in when leaderboards launch</Text></Pressable>

    {!!social.profile && !!ride.data.rides.length && <><Button title={importConfirm ? 'Confirm sharing saved rides' : 'Share earlier saved rides'} secondary onPress={() => {

      if (!importConfirm) { setImportConfirm(true); return; }

      void save(value => ({ ...value, publicationStart: 0 })).then(saved => { if (saved) { setMessage('Earlier rides queued for sharing with your profile audience.'); setImportConfirm(false); } });

    }} />{importConfirm && <Button title="Cancel historical sharing" secondary onPress={() => setImportConfirm(false)} />}</>}

    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}

  </View>;

}



export default function ProfileScreen() {

  const ride = useRide();

  const social = useSocial();

  const { local } = useLocal();

  const [editing, setEditing] = useState(false);

  const [settings, setSettings] = useState(false);

  const total = ride.data.rides.reduce((sum, item) => sum + item.meters, 0);

  const name = social.profile?.display_name ?? 'Your rider profile';

  return <Page>

    <Heading title="Profile" action={<Pressable accessibilityRole="button" accessibilityLabel="Sharing and privacy settings" onPress={() => setSettings(!settings)} style={{ padding: 12 }}><Ionicons name="settings-outline" size={26} color={colors.ink} /></Pressable>} />

    <View style={s.row}><View style={[s.avatar, { width: 72, height: 72, borderRadius: 36 }]}><Text style={s.section}>{social.profile ? name.slice(0, 2).toUpperCase() : <Ionicons name="person-outline" size={32} />}</Text></View><View style={{ flex: 1 }}><Text style={s.section}>{name}</Text><Text style={s.body}>{social.profile ? `@${social.profile.username} · ${social.profile.visibility}` : 'Set up your identity and find your crew.'}</Text></View></View>

    {!!social.profile?.bio && <Text style={s.body}>{social.profile.bio}</Text>}

    <View style={s.stats}><View><Text style={s.number}>{miles(total)}</Text><Text style={s.small}>Total miles</Text></View><View><Text style={s.number}>{ride.data.rides.length}</Text><Text style={s.small}>Saved rides</Text></View><View><Text style={s.number}>N/A</Text><Text style={s.small}>Longest wheelie</Text></View></View>

    <Text style={s.small}>Riding totals are calculated from saved rides on this device.</Text>

    <Button title={editing ? 'Close profile editor' : social.profile ? 'Edit profile' : 'Set up rider profile'} secondary onPress={() => setEditing(!editing)} />

    {(!social.profile || editing) && <ProfileEditor key={social.profile?.id ?? 'new'} />}

    {!!(social.error || social.publicationError) && <Text accessibilityRole="alert" style={s.body}>{social.error || social.publicationError}</Text>}

    {settings && <SharingSettings />}

    <View style={s.divider}><Text style={s.section}>Achievements</Text>{ride.data.rides.length ? <View style={s.row}><Ionicons name="ribbon-outline" size={30} color={colors.accent} /><View><Text style={s.label}>First ride</Text><Text style={s.small}>Finish and save your first ride.</Text></View></View> : <Text style={s.body}>Your first saved ride earns your first achievement.</Text>}{total >= 16093.44 && <View style={s.row}><Ionicons name="ribbon-outline" size={30} color={colors.accent} /><Text style={s.label}>10 miles ridden</Text></View>}</View>

    <View style={s.divider}><Heading title="Your build" action={<Button title="Edit bike" secondary onPress={() => router.navigate('/garage')} />} /><BikeViewer build={{ ...ride.data.bike, mods: local?.mods ?? [], color: local?.color ?? '#a5d9ef' }} />{local?.mods.map(mod => <View key={mod.id} style={s.row}><Ionicons name="build-outline" size={18} color={colors.muted} /><Text style={s.body}>{mod.name}</Text></View>)}</View>

    <View style={s.divider}><Text style={s.section}>Ride history</Text>

      {!ride.data.rides.length && <Empty icon="trail-sign-outline" title="Your first route is waiting." detail="Start a ride on Home, then finish to save your route and stats." />}

      {ride.data.rides.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View ride from ${new Date(item.startedAt).toLocaleDateString()}`} onPress={() => router.push({ pathname: '/rides/[rideId]', params: { rideId: item.id } })} style={[s.row, { paddingVertical: 12 }]}><View style={{ flex: 1 }}><Text style={s.label}>{new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text><Text style={s.body}>{miles(item.meters)} mi · {duration(((item.endedAt ?? item.startedAt) - item.startedAt) / 1000)}</Text></View><Ionicons name="chevron-forward" size={22} color={colors.muted} /></Pressable>)}

    </View>

    {!!social.profile && <View style={s.divider}><Text style={s.section}>Your rides & posts</Text><ActivityFeed target={social.profile.id} /></View>}

  </Page>;

}



export function RiderScreen() {

  const params = useLocalSearchParams<{ riderId: string }>();

  const id = params.riderId;

  const social = useSocial();

  const [rider, setRider] = useState<Rider | null>(null);

  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);

  const [confirmBlock, setConfirmBlock] = useState(false);

  const [report, setReport] = useState('');

  const generation = useRef(0);

  const load = useCallback(async () => {

    const request = ++generation.current;

    try { const value = await socialRequest<Rider>('profile', { target: id }); if (generation.current === request) { setRider(value); setMessage(''); } }

    catch (e) { if (generation.current === request) { setRider(null); setMessage(String(e)); } }

  }, [id]);

  useFocusEffect(useCallback(() => { setRider(null); void load(); return () => { generation.current++; setRider(null); }; }, [load]));

  async function act(action: string) {

    setBusy(true);

    try {

      await socialRequest(action, { target: id, reason: report.trim() });

      if (action === 'block') { router.replace('/friends'); return; }

      if (action === 'report') { setReport(''); setMessage('Report submitted.'); }

      else await load();

    } catch (e) { setMessage(String(e)); }

    finally { setBusy(false); }

  }

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}><Page>

    <Button title="Back to Friends" secondary onPress={() => router.replace('/friends')} />

    {rider ? <><Heading title={rider.display_name} detail={`@${rider.username} · ${rider.visibility}`} /><Text style={s.body}>{rider.bio}</Text>

      {rider.id !== social.profile?.id && <>

        <Button title={rider.friend ? 'Remove friend' : rider.incoming ? 'Accept friend request' : rider.requested ? 'Cancel friend request' : 'Add friend'} disabled={busy} onPress={() => void act(rider.friend || rider.requested ? 'remove_friend' : rider.incoming ? 'accept' : 'request')} />

        <Button title={rider.following ? 'Unfollow' : 'Follow'} secondary disabled={busy} onPress={() => void act(rider.following ? 'unfollow' : 'follow')} />

      </>}

      {rider.can_read ? <><View style={s.stats}><View><Text style={s.number}>{miles(rider.total_meters ?? 0)}</Text><Text style={s.small}>Shared miles</Text></View><View><Text style={s.number}>{rider.ride_count ?? 0}</Text><Text style={s.small}>Shared rides</Text></View><View><Text style={s.number}>N/A</Text><Text style={s.small}>Longest wheelie</Text></View></View><Text style={s.section}>Bike build</Text>{rider.build && <BikeViewer build={rider.build} />}{rider.build?.mods?.map(mod => <Text key={mod.id} style={s.body}>{mod.name}</Text>)}<Text style={s.section}>Rides & posts</Text><ActivityFeed target={rider.id} /></> : <Empty icon="lock-closed-outline" title="This rider keeps it private." detail="Accepted friends can see their bike build, rides, and posts." />}

      {rider.id !== social.profile?.id && <View style={s.divider}><Button title={confirmBlock ? 'Confirm block rider' : 'Block rider'} secondary disabled={busy} onPress={() => confirmBlock ? void act('block') : setConfirmBlock(true)} />{confirmBlock && <Button title="Cancel block" secondary onPress={() => setConfirmBlock(false)} />}<Field label="Report reason" value={report} onChangeText={setReport} maxLength={1000} multiline /><Button title="Report rider" secondary disabled={busy || !report.trim()} onPress={() => void act('report')} /></View>}

    </> : !message && <Text style={s.body}>Loading rider…</Text>}

    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}

  </Page></SafeAreaView>;

}

