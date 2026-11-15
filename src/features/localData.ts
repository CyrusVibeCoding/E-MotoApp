import AsyncStorage from '@react-native-async-storage/async-storage';

export type Mod = { id: string; name: string; category: string };
export type PrivacyZone = { id: string; latitude: number; longitude: number; radius: number };
export type LocalData = {
  version: 1;
  installationId: string;
  mods: Mod[];
  color: string;
  zones: PrivacyZone[];
  privacyRevision: number;
  leaderboardOptIn: boolean;
  publicationStart: number | null;
};

const KEY = '@repride/local-v1';
let queue = Promise.resolve();
const fresh = (): LocalData => ({
  version: 1,
  installationId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  mods: [], color: '#a5d9ef', zones: [], privacyRevision: 0, leaderboardOptIn: false, publicationStart: null,
});

export async function readLocalData(): Promise<LocalData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return fresh();
  const value = JSON.parse(raw);
  value.privacyRevision ??= 0;
  if (value.version !== 1 || typeof value.installationId !== 'string' ||
      !Array.isArray(value.mods) || !value.mods.every((m: Mod) => typeof m.id === 'string' && typeof m.name === 'string' && typeof m.category === 'string') ||
      typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color) ||
      !Array.isArray(value.zones) || !value.zones.every((z: PrivacyZone) => typeof z.id === 'string' && Number.isFinite(z.latitude) && Math.abs(z.latitude) <= 90 && Number.isFinite(z.longitude) && Math.abs(z.longitude) <= 180 && Number.isFinite(z.radius) && z.radius >= 100) ||
      !Number.isInteger(value.privacyRevision) || value.privacyRevision < 0 || typeof value.leaderboardOptIn !== 'boolean' || !(value.publicationStart === null || Number.isFinite(value.publicationStart))) {
    throw Error('Saved build settings could not be read. Your existing rides are preserved.');
  }
  return value;
}

export function updateLocalData(change: (value: LocalData) => LocalData): Promise<LocalData> {
  const result = queue.catch(() => {}).then(async () => {
    const next = change(await readLocalData());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  });
  queue = result.then(() => {});
  return result;
}
