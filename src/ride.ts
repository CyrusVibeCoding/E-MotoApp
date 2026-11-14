export type Point = { latitude: number; longitude: number; timestamp: number; accuracy: number; segment: number };
export type Ride = { id: string; startedAt: number; endedAt?: number; lastFixAt?: number; points: Point[]; meters: number };
export type Bike = { make: string; model: string; nickname: string };
export const MAX_AGE = 15000;
export function metersBetween(a: Point, b: Point) {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function validFix(p: Point, now: number) {
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 35 && p.timestamp <= now + 5000 && now - p.timestamp <= MAX_AGE;
}
export function appendPoint(ride: Ride, p: Point): Ride {
  const last = ride.points.at(-1);
  if (!last) return { ...ride, points: [p] };
  if (p.timestamp <= (ride.lastFixAt ?? last.timestamp)) return ride;
  const gap = p.timestamp - last.timestamp;
  const distance = metersBetween(last, p);
  const same = last.segment === p.segment && p.timestamp - (ride.lastFixAt ?? last.timestamp) <= MAX_AGE;
  // Reject implausible jumps (>45 m/s); ignore small stationary jitter.
  if (same && distance / (gap / 1000) > 45) return ride;
  if (same && distance < Math.max(4, Math.max(last.accuracy, p.accuracy))) return { ...ride, lastFixAt: p.timestamp };
  const point = { ...p, segment: same ? last.segment : Math.max(last.segment + 1, p.segment) };
  return { ...ride, points: [...ride.points, point], lastFixAt: p.timestamp, meters: ride.meters + (same ? distance : 0) };
}
export function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor(s / 60 % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
export const distanceLabel = (meters: number) => (meters / 1000).toFixed(2);
export function segments(points: Point[]) {
  const groups: Point[][] = [];
  for (const p of points) {
    if (!groups.length || groups.at(-1)![0].segment !== p.segment) groups.push([]);
    groups.at(-1)!.push(p);
  }
  return groups;
}
