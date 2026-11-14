import type { Bike, Ride } from './ride';
export type Data = { version: 1; rides: Ride[]; draft: Ride | null; bike: Bike };
export const emptyData: Data = { version: 1, rides: [], draft: null, bike: { make: '', model: '', nickname: '' } };
type Adapter = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const KEY = '@emoto/v1';
function validRide(value: any): value is Ride {
  return value && typeof value.id === 'string' && Number.isFinite(value.startedAt) && Number.isFinite(value.meters) && value.meters >= 0 && (value.endedAt === undefined || Number.isFinite(value.endedAt) && value.endedAt >= value.startedAt) && Array.isArray(value.points) && value.points.every((p: any) => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && Number.isFinite(p.timestamp) && Number.isFinite(p.accuracy) && Number.isInteger(p.segment));
}
export function createStorage(adapter: Adapter) {
  let queue = Promise.resolve();
  return {
    async readData(): Promise<Data> {
      const raw = await adapter.getItem(KEY);
      if (!raw) return { ...emptyData, rides: [], bike: { ...emptyData.bike } };
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !Array.isArray(value.rides) || !value.rides.every((r: any) => validRide(r) && Number.isFinite(r.endedAt)) || !value.bike || !['make', 'model', 'nickname'].every(k => typeof value.bike[k] === 'string') || !(value.draft === null || validRide(value.draft))) throw new Error('Unsupported saved data');
      return value;
    },
    writeData(value: Data) {
      const serialized = JSON.stringify(value);
      const next = queue.catch(() => {}).then(() => adapter.setItem(KEY, serialized));
      queue = next;
      return next;
    }
  };
}
