import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const groupConfigured = !!url && !!key;
export const client = groupConfigured ? createClient(url!, key!, {
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

let signingIn: Promise<void> | null = null;
export async function ensureIdentity() {
  if (!client) throw Error('The rider service is not configured.');
  if (!signingIn) {
    signingIn = (async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        const { error: signInError } = await client.auth.signInAnonymously();
        if (signInError) throw Error('Could not connect your rider identity. Check your connection and retry.');
      }
    })().finally(() => { signingIn = null; });
  }
  await signingIn;
  return client;
}
export function setAuthForeground(active: boolean) {
  if (active) client?.auth.startAutoRefresh(); else client?.auth.stopAutoRefresh();
}
