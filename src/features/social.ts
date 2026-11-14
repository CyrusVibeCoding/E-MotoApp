import { ensureIdentity } from '../supabase';
import type { Build } from './BikeViewer';

export type Rider = {
  id: string; username: string; display_name: string; bio: string;
  visibility: 'private' | 'public'; build: Build | null; total_meters?: number; ride_count?: number;
  can_read?: boolean; friend?: boolean; following?: boolean; requested?: boolean; incoming?: boolean;
};
export type Connection = Pick<Rider, 'id' | 'username' | 'display_name'> & { accepted: boolean; incoming: boolean };
export type Activity = {
  id: string; owner: string; kind: 'post' | 'ride'; body: string | null;
  ride_date: string | null; meters: number | null; route: { latitude: number; longitude: number }[][] | null;
  moving_seconds: number | null; average_speed: number | null; top_speed: number | null;
  hidden: boolean; map_hidden: boolean; created_at: string; username: string; display_name: string;
};
export type FriendLocation = Pick<Rider, 'id' | 'username' | 'display_name'> & {
  latitude: number; longitude: number; observed_at: string; expires_at: string;
};

export async function socialRequest<T>(action: string, payload: object = {}): Promise<T> {
  const client = await ensureIdentity();
  const { data, error } = await client.rpc('repride_social', { action, payload });
  if (error?.code === '23505') throw Error('That username is already taken. Choose another.');
  if (error) throw Error(error.message.includes('repride_social') ? 'The social service needs its database update. Your local rides are available.' : error.message);
  return data as T;
}

export function newPostId() {
  // UUIDs keep a retried post idempotent across unreliable connections.
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
