import React, { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSocial } from './Runtime';
import { newPostId, socialRequest, type Connection, type Rider } from './social';
import ActivityFeed from './ActivityFeed';
import { Button, colors, Empty, Field, Heading, Page, s } from './ui';

export default function FriendsScreen() {
  const social = useSocial();
  const [searchOpen, setSearchOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Rider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [body, setBody] = useState('');
  const [postId, setPostId] = useState(newPostId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const searchGeneration = useRef(0);
  useFocusEffect(useCallback(() => {
    let live = true;
    if (social.profile) void socialRequest<Connection[]>('connections').then(value => { if (live) setConnections(value); }).catch(e => { if (live) { setConnections([]); setMessage(String(e)); } });
    return () => { live = false; searchGeneration.current++; setResults([]); setConnections([]); };
  }, [social.profile]));
  async function search() {
    const generation = ++searchGeneration.current;
    setBusy(true); setResults([]);
    try { const riders = await socialRequest<Rider[]>('search', { query: query.trim() }); if (generation === searchGeneration.current) { setResults(riders); setMessage(riders.length ? '' : 'No riders found.'); } }
    catch (e) { if (generation === searchGeneration.current) setMessage(String(e)); }
    finally { if (generation === searchGeneration.current) setBusy(false); }
  }
  async function post() {
    setBusy(true);
    try {
      await socialRequest('post', { id: postId, body: body.trim() });
      setBody(''); setPostId(newPostId()); setComposerOpen(false); setRevision(value => value + 1); setMessage('Post shared.');
    } catch (e) { setMessage(String(e)); }
    finally { setBusy(false); }
  }
  return <Page>
    <Heading title="Friends" detail="Good rides. Better company." action={<Pressable accessibilityRole="button" accessibilityLabel="Search riders and friend requests" onPress={() => setSearchOpen(!searchOpen)} style={{ padding: 12 }}><Ionicons name={searchOpen ? 'close-outline' : 'person-add-outline'} color={colors.ink} size={26} /></Pressable>} />
    {!social.profile ? <><Empty icon="people-outline" title="Find your riding people." detail="Create your rider profile to search, add friends, follow riders, and share rides and posts." /><Button title="Set up rider profile" onPress={() => router.navigate('/profile')} />{social.error && <Text style={s.body}>{social.error}</Text>}</> : <>
      {searchOpen && <View style={s.divider}>
        <Field label="Search riders" value={query} maxLength={48} onChangeText={value => { setQuery(value); setResults([]); searchGeneration.current++; setBusy(false); }} placeholder="Username or rider name" autoCapitalize="none" onSubmitEditing={() => void search()} />
        <Button title={busy ? 'Searching…' : 'Search'} secondary onPress={() => void search()} disabled={busy || query.trim().length < 2} />
        {results.map(rider => <Pressable key={rider.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/riders/[riderId]', params: { riderId: rider.id } })} style={s.row}><View style={s.avatar}><Text style={s.label}>{rider.display_name.slice(0, 2).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.label}>{rider.display_name}</Text><Text style={s.body}>@{rider.username}</Text></View><Ionicons name="chevron-forward" size={22} /></Pressable>)}
        <Text style={s.section}>Friends & requests</Text>
        {!connections.length && <Text style={s.body}>Search for a rider to send your first friend request.</Text>}
        {connections.map(rider => <View key={rider.id} style={s.row}><Pressable accessibilityRole="button" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/riders/[riderId]', params: { riderId: rider.id } })}><Text style={s.label}>{rider.display_name}</Text><Text style={s.small}>{rider.accepted ? 'Friends' : rider.incoming ? 'Wants to be friends' : 'Request sent'}</Text></Pressable>{!rider.accepted && rider.incoming && <Button title="Accept" onPress={() => void socialRequest('accept', { target: rider.id }).then(() => socialRequest<Connection[]>('connections')).then(setConnections).catch(e => setMessage(String(e)))} secondary />}</View>)}
      </View>}
      <Button title={composerOpen ? 'Close post composer' : 'Write a post'} secondary onPress={() => setComposerOpen(!composerOpen)} />
      {composerOpen && <View style={{ gap: 12 }}><Field label="Your post" value={body} onChangeText={value => { setBody(value); setPostId(newPostId()); }} multiline maxLength={2000} placeholder="Where did you ride?" style={{ minHeight: 110, textAlignVertical: 'top' }} /><Text style={s.small}>{social.profile.visibility === 'private' ? 'Visible to accepted friends.' : 'Visible publicly.'}</Text><Button title={busy ? 'Sharing…' : 'Share post'} disabled={busy || !body.trim()} onPress={() => void post()} /></View>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
      <ActivityFeed key={revision} />
    </>}
  </Page>;
}
