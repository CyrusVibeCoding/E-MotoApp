import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import RouteMap from '../RouteMap';
import { duration } from '../ride';
import { useLocal, useRide, useSocial } from './Runtime';
import { socialRequest } from './social';
import { publicationOrigin, syncPublications } from './publications';
import { Button, Heading, miles, Page, s } from './ui';

export default function RideScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const recorder = useRide();
  const social = useSocial();
  const { local } = useLocal();
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const ride = recorder.data.rides.find(value => value.id === rideId);
  async function visibility(change: object) {
    if (!social.profile || !local || !ride) return;
    setBusy(true);
    try {
      await syncPublications(social.profile.id, [ride], local);
      await socialRequest('ride_visibility', { origin: publicationOrigin(local, ride), ...change });
      setMessage('Ride sharing updated.');
    } catch (e) { setMessage(String(e)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!ride || !local) return;
    setBusy(true);
    try {
      if (social.profile && local.publicationStart !== null && ride.endedAt! >= local.publicationStart) {
        await syncPublications(social.profile.id, [ride], local);
        await socialRequest('ride_visibility', { origin: publicationOrigin(local, ride), deleted: true });
      }
      const removed = await recorder.deleteRide(ride.id);
      // A successful void command returns undefined. Failures return null.
      if (removed !== null) router.replace('/profile');
    } catch (e) { setMessage(String(e)); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}><Page>
    <Button title="Back to Profile" secondary onPress={() => router.replace('/profile')} />
    {!ride ? <Text style={s.body}>This ride is unavailable.</Text> : <>
      <Heading title="Ride summary" detail={new Date(ride.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} />
      <View style={{ height: 280, overflow: 'hidden', borderRadius: 14 }}><RouteMap points={ride.points} /></View>
      <View style={s.stats}><View><Text style={s.number}>{miles(ride.meters)} mi</Text><Text style={s.small}>Recorded distance</Text></View><View><Text style={s.number}>{duration(((ride.endedAt ?? ride.startedAt) - ride.startedAt) / 1000)}</Text><Text style={s.small}>Elapsed time</Text></View></View>
      {ride.measurements && <View style={s.stats}><View><Text style={s.number}>{duration(ride.measurements.movingSeconds)}</Text><Text style={s.small}>Moving time</Text></View><View><Text style={s.number}>{(ride.measurements.topSpeed * 2.236936).toFixed(1)} mph</Text><Text style={s.small}>Top GPS speed</Text></View><View><Text style={s.number}>{(ride.measurements.movingSeconds ? ride.measurements.movingMeters / ride.measurements.movingSeconds * 2.236936 : 0).toFixed(1)} mph</Text><Text style={s.small}>Average moving speed</Text></View></View>}
      <Text style={s.small}>GPS estimates use accepted same-segment fixes. Moving time counts segments at 1 m/s or faster. Gaps and stationary jitter are excluded.</Text>
      <Text style={s.body}>Your private route is shown here. Route gaps are excluded from distance. Elapsed time includes interruptions.</Text>
      {!!social.profile && local?.publicationStart !== null && ride.endedAt! >= (local?.publicationStart ?? Infinity) && <View style={s.divider}><Text style={s.section}>Ride sharing</Text><Button title="Hide ride from other riders" secondary disabled={busy} onPress={() => void visibility({ hidden: true })} /><Button title="Show ride to profile audience" secondary disabled={busy} onPress={() => void visibility({ hidden: false })} /><Button title="Hide shared map" secondary disabled={busy} onPress={() => void visibility({ map_hidden: true })} /><Button title="Show sanitized shared map" secondary disabled={busy} onPress={() => void visibility({ map_hidden: false })} /></View>}
      <View style={s.divider}><Button title={confirm ? 'Confirm delete ride' : 'Delete ride'} secondary disabled={busy} onPress={() => confirm ? void remove() : setConfirm(true)} />{confirm && <Button title="Cancel deletion" secondary onPress={() => setConfirm(false)} />}</View>
      {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
    </>}
  </Page></SafeAreaView>;
}
