import React, { useEffect, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupSession, memberStatus } from './groupModel';
import { Point, segments } from './ride';
export default function RouteMap({ points, location, group, connected = false, serverNow = 0 }: { points: Point[]; location?: Point | null; group?: GroupSession | null; connected?: boolean; serverNow?: number }) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const ready = useRef(false);
  const center = points.at(-1) ?? location;
  function fit() {
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: false });
    else if (center) map.current?.animateToRegion({ ...center, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 0);
  }
  function initialFit() { if (ready.current && !fitted.current && center) { fit(); fitted.current = true; } }
  useEffect(() => { initialFit(); });
  return <><MapView ref={map} style={StyleSheet.absoluteFill} onMapReady={() => { ready.current = true; initialFit(); }} showsUserLocation={!!location} mapType="standard" initialRegion={center ? { ...center, latitudeDelta: 0.008, longitudeDelta: 0.008 } : undefined}>
    {segments(points).map((line, i) => line.length > 1 ? <Polyline key={i} coordinates={line} strokeColor="#171717" strokeWidth={5} /> : null)}
    {points[0] && <Marker coordinate={points[0]} title="Start" pinColor="#171717" />}
    {points.length > 1 && <Marker coordinate={points[points.length - 1]} title="Latest recorded point" pinColor="#606060" />}
    {group?.members.map(member => member.latitude !== null && member.longitude !== null ? <Marker key={member.id} coordinate={{ latitude: member.latitude, longitude: member.longitude }} title={`${member.name} - ${memberStatus(member, serverNow, connected)}`} description={member.observed_at ? `Updated ${new Date(member.observed_at).toLocaleTimeString()}` : 'Waiting for GPS'}>
      <View style={{ padding: 7, borderRadius: 12, backgroundColor: memberStatus(member, serverNow, connected) === 'Live' ? '#171717' : '#ededed', borderColor: '#606060', borderWidth: 1 }}><Text style={{ color: memberStatus(member, serverNow, connected) === 'Live' ? '#fff' : '#171717', fontWeight: '600' }}>{member.name}{memberStatus(member, serverNow, connected) === 'Live' ? ' - Live' : ' - Last known'}</Text></View>
    </Marker> : null)}
  </MapView>{location && <Pressable accessibilityRole="button" accessibilityLabel="Return to my location" onPress={() => map.current?.animateToRegion({ ...location, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 0)} style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, minHeight: 48, minWidth: 48 }}><Ionicons name="locate-outline" size={24} color="#171717" /></Pressable>}</>;
}
