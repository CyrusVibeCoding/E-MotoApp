import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ride } from '../ride';
import type { LocalData } from './localData';
import { rideDate, sharedRoute } from './privacy';
import { socialRequest } from './social';

let queue: Promise<unknown> = Promise.resolve();
export function publicationOrigin(local: LocalData, ride: Ride) {
  return `${local.installationId}:${ride.id}`;
}

// Saved rides are the durable outbox. A failed request is retried on refresh or
// relaunch, and the server's owner/origin key deduplicates uncertain responses.
export function syncPublications(owner: string, rides: Ride[], local: LocalData): Promise<void> {
  const result = queue.catch(() => {}).then(async () => {
    if (local.publicationStart === null) return;
    const key = `@repride/publications/${owner}/${local.installationId}`;
    const delivered = new Set<string>(JSON.parse(await AsyncStorage.getItem(key) ?? '[]'));
    for (const ride of rides) {
      if (!ride.endedAt || ride.endedAt < local.publicationStart || delivered.has(ride.id)) continue;
      await socialRequest('publish_ride', {
        origin: publicationOrigin(local, ride), ride_date: rideDate(ride.startedAt),
        privacy_revision: local.privacyRevision,
        meters: ride.meters,
        moving_seconds: ride.measurements?.movingSeconds ?? null,
        average_speed: ride.measurements ? (ride.measurements.movingSeconds ? ride.measurements.movingMeters / ride.measurements.movingSeconds : 0) : null,
        top_speed: ride.measurements?.topSpeed ?? null,
        route: sharedRoute(ride, local.zones),
      });
      delivered.add(ride.id);
      await AsyncStorage.setItem(key, JSON.stringify([...delivered]));
    }
  });
  queue = result;
  return result;
}
