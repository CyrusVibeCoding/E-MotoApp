import { client, ensureIdentity } from './supabase';
export { groupConfigured, setAuthForeground } from './supabase';
export async function groupRequest(action: string, payload: object, signal?: AbortSignal) {
  if (!client) throw Error('Group rides need backend setup. See GROUP-RIDES.md.');
  await ensureIdentity();
  const request = client.rpc('emoto_group', { action, payload });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw Error('Group connection failed. Retrying when connected.');
  return data;
}
