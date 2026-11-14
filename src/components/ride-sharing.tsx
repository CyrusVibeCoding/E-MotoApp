import { Alert, Pressable, Switch, Text, View, StyleSheet } from 'react-native';

export type CompletedRide = {
  id: string;
  date: string;
  hidden: boolean;
  mapHidden: boolean;
};

type Props = {
  publicProfile: boolean;
  onPublicProfileChange: (value: boolean) => void;
  leaderboard: boolean;
  onLeaderboardChange: (value: boolean) => void;
  rides: CompletedRide[];
  onRidesChange: (rides: CompletedRide[]) => void;
};

export function SharingSettings(props: Props) {
  return <View style={styles.panel}>
    <Text style={styles.title}>Ride sharing</Text>
    <View style={styles.row}><Text style={styles.label}>Public profile</Text><Switch accessibilityLabel="Public profile" value={props.publicProfile} onValueChange={props.onPublicProfileChange} /></View>
    <Text style={styles.note}>{props.publicProfile ? 'Completed rides share publicly.' : 'Completed rides share with friends.'}</Text>
    <View style={styles.row}><Text style={styles.label}>Join leaderboards</Text><Switch accessibilityLabel="Join leaderboards" value={props.leaderboard} onValueChange={props.onLeaderboardChange} /></View>
    <Text style={styles.note}>Shared rides show distance, moving time, average speed, top speed, and date. Departure time and exact start/end locations stay private.</Text>
    <Text style={styles.note}>Route sharing will hide the first and last 500 metres. Privacy zones and real route recording are still being built.</Text>
    <Text style={styles.note}>Preview settings and rides reset when the app reloads.</Text>
  </View>;
}

export function CompletedRides({ rides, onRidesChange, publicProfile }: Props) {
  if (!rides.length) return null;
  function update(id: string, changes: Partial<CompletedRide>) {
    onRidesChange(rides.map(ride => ride.id === id ? { ...ride, ...changes } : ride));
  }
  return <View>
    <Text style={styles.title}>Completed rides</Text>
    {rides.map(ride => <View key={ride.id} style={styles.panel}>
      <Text style={styles.label}>{ride.date}</Text>
      <Text style={styles.note}>{ride.hidden ? 'Only you' : publicProfile ? 'Public' : 'Friends only'}</Text>
      <Text style={styles.label}>6.4 mi · 21 min moving</Text>
      <Text style={styles.note}>18.2 mph average · 24.6 mph top speed</Text>
      <Text style={styles.note}>{ride.mapHidden ? 'Map hidden' : 'Map pending real route recording'}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => update(ride.id, { hidden: !ride.hidden })}><Text style={styles.action}>{ride.hidden ? 'Share ride' : 'Hide ride'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => update(ride.id, { mapHidden: !ride.mapHidden })}><Text style={styles.action}>{ride.mapHidden ? 'Show map' : 'Hide map'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Delete ride?', 'This removes the ride from this preview.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => onRidesChange(rides.filter(item => item.id !== ride.id)) }])}><Text style={styles.action}>Delete</Text></Pressable>
      </View>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 16, backgroundColor: '#f4f6f7', borderRadius: 14, marginVertical: 12, gap: 10 },
  title: { fontFamily: 'DMSansBold', fontSize: 16, color: '#151719', marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontFamily: 'DMSansMedium', fontSize: 13, color: '#151719', flexShrink: 1 },
  note: { fontFamily: 'DMSans', fontSize: 11, lineHeight: 18, color: '#68727a' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  action: { fontFamily: 'DMSansMedium', fontSize: 12, color: '#285772', paddingVertical: 10 },
});
