export type Coordinate = { latitude: number; longitude: number };
export type PrivacyZone = Coordinate & { radiusMetres: number };

function valid(point: Coordinate) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

function distance(a: Coordinate, b: Coordinate) {
  const radians = Math.PI / 180;
  const latitude = (b.latitude - a.latitude) * radians;
  const longitude = (b.longitude - a.longitude) * radians;
  const value = Math.sin(latitude / 2) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}

// Return separate segments so renderers cannot draw across a hidden area.
// Sparse segments near a zone are conservatively omitted using the triangle inequality.
export function sharedRoute(route: Coordinate[], zones: PrivacyZone[] = []): Coordinate[][] {
  if (route.length < 2 || route.some(point => !valid(point))
    || zones.some(zone => !valid(zone) || !Number.isFinite(zone.radiusMetres) || zone.radiusMetres <= 0)) return [];
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) cumulative.push(cumulative[i - 1] + distance(route[i - 1], route[i]));
  const total = cumulative[cumulative.length - 1];
  const protectedZones = [...zones, { ...route[0], radiusMetres: 500 }, { ...route[route.length - 1], radiusMetres: 500 }];
  const segments: Coordinate[][] = [];
  let segment: Coordinate[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const length = distance(a, b);
    const safe = cumulative[i - 1] >= 500 && cumulative[i] <= total - 500
      && protectedZones.every(zone => Math.min(distance(a, zone), distance(b, zone)) > zone.radiusMetres + length);
    if (safe) {
      if (!segment.length) segment.push({ ...a });
      segment.push({ ...b });
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
  }
  if (segment.length) segments.push(segment);
  return segments;
}
