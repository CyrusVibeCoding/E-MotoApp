import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Bike } from '../ride';
import type { Mod } from './localData';
import { colors, s } from './ui';

export type Build = Bike & { mods: Mod[]; color: string };
export default function BikeViewer({ build, preview = false }: { build: Build; preview?: boolean }) {
  const configured = !!(build.make || build.model || build.nickname);
  return <View style={v.root}>
    {preview ? <Image source={require('../../assets/photos/bike.jpg')} accessibilityLabel="Example bike photograph" style={v.photo} /> : <View style={[v.stage, { backgroundColor: build.color + '30' }]}><Ionicons name="bicycle-outline" size={88} color={colors.ink} /></View>}
    <View style={v.caption}><Text style={s.section}>{build.nickname || (configured ? [build.make, build.model].join(' ').trim() : 'Your bike goes here')}</Text>
      <Text style={s.body}>{[build.make, build.model].filter(Boolean).join(' ') || 'Add your bike details to start your build.'}</Text>
      {preview && <Text style={s.small}>Reference photo</Text>}
    </View>
  </View>;
}
const v = StyleSheet.create({ root: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.soft }, photo: { width: '100%', height: 220, resizeMode: 'cover' }, stage: { height: 190, alignItems: 'center', justifyContent: 'center' }, caption: { padding: 20, gap: 5 } });
