import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useEffectEvent } from 'react';
import { useRecorder } from '../useRecorder';
import { useGroupRide } from '../useGroupRide';
import { client, groupConfigured } from '../supabase';
import { updateLocalData, type LocalData } from './localData';
import { socialRequest, type Rider } from './social';
import { syncPublications } from './publications';

const RecorderContext = createContext<ReturnType<typeof useRecorder> | null>(null);
const GroupContext = createContext<ReturnType<typeof useGroupRide> | null>(null);
type LocalContextValue = { local: LocalData | null; error: string; save: (change: (value: LocalData) => LocalData) => Promise<boolean> };
const LocalContext = createContext<LocalContextValue | null>(null);
type SocialValue = { profile: Rider | null; ready: boolean; configured: boolean; error: string; publicationError: string; refresh: () => Promise<void> };
const SocialContext = createContext<SocialValue | null>(null);

export function Runtime({ children }: React.PropsWithChildren) {
  const recorder = useRecorder();
  const group = useGroupRide(recorder.fix, recorder.status);
  const [local, setLocal] = useState<LocalData | null>(null);
  const [localError, setLocalError] = useState('');
  const [profile, setProfile] = useState<Rider | null>(null);
  const [ready, setReady] = useState(!groupConfigured);
  const [error, setError] = useState('');
  const [publicationError, setPublicationError] = useState('');
  const save = useCallback(async (change: (value: LocalData) => LocalData) => {
    try { setLocal(await updateLocalData(change)); setLocalError(''); return true; }
    catch (e) { setLocalError(String(e)); return false; }
  }, []);
  const refresh = useCallback(async () => {
    try {
      const me = await socialRequest<{ id: string; profile: Rider | null }>('me');
      setProfile(me.profile); setError('');
    } catch (e) { setError(String(e)); }
    finally { setReady(true); }
  }, []);
  useEffect(() => {
    let live = true;
    void updateLocalData(value => value).then(value => { if (live) setLocal(value); }).catch(e => { if (live) setLocalError(String(e)); });
    void client?.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data.session) void refresh(); else setReady(true);
    });
    return () => { live = false; };
  }, [refresh]);
  const ridesKey = recorder.data.rides.map(ride => ride.id).join('|');
  const publish = useEffectEvent(async () => {
    if (!profile || !local) return;
    try { await syncPublications(profile.id, recorder.data.rides, local); setPublicationError(''); }
    catch { setPublicationError('Ride sharing is waiting for a connection. Saved rides will retry automatically.'); }
  });
  useEffect(() => {
    const startup = setTimeout(() => void publish(), 0);
    const timer = setInterval(() => void publish(), 30000);
    return () => { clearTimeout(startup); clearInterval(timer); };
  }, [profile?.id, local, ridesKey]);
  const localValue = useMemo(() => ({ local, error: localError, save }), [local, localError, save]);
  const socialValue = useMemo(() => ({ profile, ready, configured: groupConfigured, error, publicationError, refresh }), [profile, ready, error, publicationError, refresh]);
  return <RecorderContext.Provider value={recorder}><GroupContext.Provider value={group}>
    <LocalContext.Provider value={localValue}><SocialContext.Provider value={socialValue}>{children}</SocialContext.Provider></LocalContext.Provider>
  </GroupContext.Provider></RecorderContext.Provider>;
}
function required<T>(value: T | null): T { if (!value) throw Error('RepRide runtime is unavailable.'); return value; }
export const useRide = () => required(useContext(RecorderContext));
export const useGroup = () => required(useContext(GroupContext));
export const useLocal = () => required(useContext(LocalContext));
export const useSocial = () => required(useContext(SocialContext));
