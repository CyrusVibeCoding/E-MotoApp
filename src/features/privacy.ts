import { metersBetween, segments, type Point, type Ride } from '../ride.ts';
import type { PrivacyZone } from './localData';

type Coordinate = { latitude: number; longitude: number };
const distance = (a: Coordinate, b: Coordinate) => metersBetween(a as Point, b as Point);

// A whole edge is omitted when it could cross a hidden circle. Keeping only
// edges outside the circle prevents the renderer from bridging private gaps.
function edgeOutside(a: Coordinate, b: Coordinate, center: Coordinate, radius: number) {
  // The distance-to-endpoint lower bound is conservative for every point
  // along the edge, including sparse segments, poles, and the antimeridian.
  return Math.min(distance(a, center), distance(b, center)) > radius + distance(a, b) + 35;
}

export function sharedRoute(ride: Ride, zones: PrivacyZone[]): Coordinate[][] {
  const points = ride.points;
  if (points.length < 2) return [];
  const valid = (p: Point) => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  if (!points.every(valid)) return [];
  const protectedAreas = [
    { ...points[0], radius: 500 }, { ...points[points.length - 1], radius: 500 }, ...zones,
  ];
  const fromStart = new Map<Point, number>();
  let travelled = 0;
  for (let i = 0; i < points.length; i++) {
    if (i && points[i].segment === points[i - 1].segment) travelled += distance(points[i - 1], points[i]);
    fromStart.set(points[i], travelled);
  }
  const result: Coordinate[][] = [];
  for (const segment of segments(points)) {
    let line: Coordinate[] = [];
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1], b = segment[i];
      const permitted = fromStart.get(a)! >= 500 && travelled - fromStart.get(b)! >= 500 &&
        protectedAreas.every(zone => edgeOutside(a, b, zone, zone.radius));
      if (permitted) {
        if (!line.length) line.push({ latitude: a.latitude, longitude: a.longitude });
        line.push({ latitude: b.latitude, longitude: b.longitude });
      } else if (line.length) { result.push(line); line = []; }
    }
    if (line.length) result.push(line);
  }
  return result;
}

export function insidePrivacyZone(point: Coordinate, zones: PrivacyZone[]) {
  return zones.some(zone => distance(point, zone) <= zone.radius + 35);
}

export function rideDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
