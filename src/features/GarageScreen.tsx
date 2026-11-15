import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLocal, useRide, useSocial } from './Runtime';
import BikeViewer from './BikeViewer';
import type { Bike } from '../ride';
import { socialRequest } from './social';
import { Button, colors, Field, Heading, Page, s } from './ui';

export default function GarageScreen() {
  const ride = useRide();
  const { local, save } = useLocal();
  const social = useSocial();
  const [draft, setDraft] = useState<Bike | null>(null);
  const [message, setMessage] = useState('');
  const [mod, setMod] = useState('');
  const [category, setCategory] = useState('Upgrade');
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState(true);
  const bike = draft ?? ride.data.bike;
  const build = { ...ride.data.bike, mods: local?.mods ?? [], color: local?.color ?? '#a5d9ef' };
  async function saveBike() {
    setSaving(true);
    const saved = await ride.saveBike({ make: bike.make.trim(), model: bike.model.trim(), nickname: bike.nickname.trim() });
    setMessage(saved ? 'Bike saved on this device.' : 'Bike could not be saved. Please retry.');
    if (saved) setDraft(null);
    setSaving(false);
  }
  async function addMod() {
    if (!mod.trim() || !local) return;
    const saved = await save(value => ({ ...value, mods: [...value.mods, { id: `${Date.now()}-${Math.random()}`, name: mod.trim(), category }] }));
    if (saved) { setMod(''); setMessage('Installed mod saved.'); }
  }
  async function shareBuild() {
    if (!social.profile) { router.navigate('/profile'); return; }
    setSaving(true);
    try {
      await socialRequest('save_profile', { ...social.profile, build });
      await social.refresh(); setMessage('Build updated on your rider profile.');
    } catch (e) { setMessage(String(e)); }
    finally { setSaving(false); }
  }
  return <Page>
    <Heading title="Your garage" detail="Build it your way." />
    <BikeViewer build={build} preview={reference} />
    <Pressable accessibilityRole="switch" aria-checked={reference} accessibilityState={{ checked: reference }} onPress={() => setReference(!reference)} style={s.row}><Ionicons name={reference ? 'checkbox' : 'square-outline'} size={24} color={colors.accent} /><Text style={s.body}>Show reference bike photo</Text></Pressable>
    <View style={s.row}><Text style={[s.section, { flex: 1 }]}>Build color</Text>{['#a5d9ef', '#c3c9cd', '#2d3a40', '#f1c794'].map(color => <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`Build color ${color}`} aria-checked={color === local?.color} accessibilityState={{ checked: color === local?.color }} disabled={!local} onPress={() => void save(value => ({ ...value, color }))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, borderWidth: color === local?.color ? 3 : 1, borderColor: colors.ink }} />)}</View>
    <Text style={s.section}>Bike details</Text>
    {(['make', 'model', 'nickname'] as const).map(field => <Field key={field} label={`Bike ${field}`} value={bike[field]} maxLength={80} placeholder={`Enter ${field}`} autoCapitalize="words" onChangeText={value => setDraft({ ...bike, [field]: value })} />)}
    <Button title={saving ? 'Saving…' : 'Save bike'} onPress={() => void saveBike()} disabled={ride.busy || saving || !ride.ready} />
    <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>
    <View style={s.divider}><Text style={s.section}>Installed mods</Text>
      {!local?.mods.length && <Text style={s.body}>Add your first upgrade or accessory.</Text>}
      {local?.mods.map(item => <View key={item.id} style={s.row}><View style={{ flex: 1 }}><Text style={s.label}>{item.name}</Text><Text style={s.small}>{item.category}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => void save(value => ({ ...value, mods: value.mods.filter(m => m.id !== item.id) }))} style={{ padding: 12 }}><Ionicons name="close-outline" size={24} color={colors.muted} /></Pressable></View>)}
      <Field label="Mod or accessory" value={mod} maxLength={100} onChangeText={setMod} placeholder="e.g. Wider foot pegs" />
      <View style={[s.row, { flexWrap: 'wrap' }]}>{['Upgrade', 'Accessory', 'Maintenance'].map(item => <Pressable key={item} accessibilityRole="radio" aria-checked={item === category} accessibilityState={{ checked: item === category }} onPress={() => setCategory(item)} style={{ padding: 12, borderRadius: 12, backgroundColor: item === category ? colors.blue : colors.soft }}><Text style={s.label}>{item}</Text></Pressable>)}</View>
      <Button title="Add installed mod" disabled={!mod.trim() || !local || local.mods.length >= 100} onPress={() => void addMod()} secondary />
      <Button title={social.profile ? 'Update profile build' : 'Set up rider profile'} onPress={() => void shareBuild()} disabled={saving || !local} />
    </View>
    <View style={s.divider}><Text style={s.section}>Interactive 3D</Text><Text style={s.body}>Specd integration is planned. Licensed bike models and a partner connection are needed for rotation, part swaps, and decals.</Text><Button title="Visit Specd" secondary onPress={() => void Linking.openURL('https://www.getspecd.app/')} /></View>
  </Page>;
}
