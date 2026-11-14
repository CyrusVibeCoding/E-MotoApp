import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const groupConfigured = !!url && !!key;
const client = groupConfigured ? createClient(url!, key!, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock },
  global: { fetch: async (input, options) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const original = options?.signal;
    if (original?.aborted) controller.abort();
    original?.addEventListener('abort', abort);
    const timer = setTimeout(abort, 10000);
    try { return await fetch(input, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); original?.removeEventListener('abort', abort); }
  } },
}) : null;
export async function groupRequest(action: string, payload: object, signal?: AbortSignal) {
  if (!client) throw Error('Group rides need backend setup. See GROUP-RIDES.md.');
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw Error('Could not connect your rider identity. Check the network and anonymous sign-in setup.');
  }
  const request = client.rpc('emoto_group', { action, payload });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw Error('Group connection failed. Retrying when connected.');
  return data;
}
export function setAuthForeground(active: boolean) {
  if (active) client?.auth.startAutoRefresh(); else client?.auth.stopAutoRefresh();
}
