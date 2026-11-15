import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const colors = { ink: '#16242b', muted: '#53656d', line: '#dce5e9', soft: '#f2f6f8', blue: '#c3e8f8', accent: '#196382', white: '#ffffff' };
export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, disabled && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}>
    <Text style={[s.buttonText, secondary && { color: colors.ink }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} /></View>;
}
export function Page({ children }: React.PropsWithChildren) {
  return <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.page}>{children}</ScrollView>;
}
export function Heading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <View style={s.heading}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.title}>{title}</Text>{detail && <Text style={s.body}>{detail}</Text>}</View>{action}</View>;
}
export function Empty({ icon, title, detail }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; detail: string }) {
  return <View style={s.empty}><Ionicons name={icon} size={34} color={colors.accent} /><Text style={s.section}>{title}</Text><Text style={s.body}>{detail}</Text></View>;
}
export const miles = (meters: number) => (meters / 1609.344).toFixed(1);
export const s = StyleSheet.create({
  page: { padding: 22, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: 'Barlow', fontSize: 42, lineHeight: 46, color: colors.ink },
  section: { fontFamily: 'DMBold', fontSize: 20, color: colors.ink },
  body: { fontFamily: 'DM', fontSize: 15, lineHeight: 23, color: colors.muted },
  small: { fontFamily: 'DM', fontSize: 12, lineHeight: 18, color: colors.muted },
  label: { fontFamily: 'DMBold', fontSize: 14, color: colors.ink },
  button: { minHeight: 50, borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.soft },
  buttonText: { fontFamily: 'DMBold', fontSize: 15, color: '#fff', textAlign: 'center' },
  field: { gap: 8 },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, fontFamily: 'DM', fontSize: 16, color: colors.ink, backgroundColor: '#fff' },
  empty: { gap: 12, paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 22, gap: 16 },
  notice: { padding: 16, backgroundColor: colors.soft, gap: 10 },
  number: { fontFamily: 'Barlow', fontSize: 36, color: colors.ink, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 8 },
  link: { fontFamily: 'DMBold', fontSize: 15, color: colors.accent },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
