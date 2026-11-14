import type { Point } from './ride';
export type GroupMember = { id: string; name: string; latitude: number | null; longitude: number | null; accuracy: number | null; observed_at: string | null; received_at: string | null; sharing: boolean };
export type GroupSession = { id: string; code: string; expires_at: string; server_time: string; self_id: string; members: GroupMember[] };
export function memberStatus(member: GroupMember, serverNow: number, connected: boolean) {
  if (!member.observed_at || member.latitude === null || member.longitude === null) return 'Waiting for GPS';
  return connected && member.sharing && serverNow - Date.parse(member.observed_at) <= 20000 ? 'Live' : 'Last known';
}
export function shareableFix(fix: Point | null, gpsStatus: string, foreground: boolean, now: number) {
  return foreground && gpsStatus === 'GPS ready' && fix && Number.isFinite(fix.latitude) && Math.abs(fix.latitude) <= 90 && Number.isFinite(fix.longitude) && Math.abs(fix.longitude) <= 180 && now - fix.timestamp <= 15000 && fix.timestamp <= now + 5000 && fix.accuracy >= 0 && fix.accuracy <= 35 ? fix : null;
}
export function normalizeCode(code: string) { return code.trim().toUpperCase(); }
