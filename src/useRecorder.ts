import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { emptyData } from "./storage";
import { Bike, validFix } from "./ride";
import {
  finishRecording,
  locateOnce,
  refreshTracking,
  requestTrackingPermission,
  saveBikeDetails,
  startRecording,
} from "./tracking";
export function useRecorder() {
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [storageError, setError] = useState(""),
    [status, setStatus] = useState("Finding your location...");
  const [fix, setFix] = useState<import("./ride").Point | null>(null),
    [now, setNow] = useState(Date.now);
  const [background, setBackground] = useState(false);
  const lock = useRef(false);
  async function refresh() {
    try {
      const value = await refreshTracking();
      setData(value.data);
      setFix(value.tracking.fix);
      setBackground(value.tracking.background);
      setStatus(
        value.tracking.fix && validFix(value.tracking.fix, Date.now())
          ? "GPS ready"
          : value.tracking.status === "GPS ready"
            ? "GPS signal lost. Waiting for updates."
            : value.tracking.status,
      );
      setReady(true);
    } catch (e) {
      setError(String(e));
    }
  }
  async function locate() {
    try {
      await locateOnce();
      await refresh();
    } catch (e) {
      setStatus(String(e));
    }
  }
  useEffect(() => {
    let live = true;
    const timer = setInterval(() => {
      if (live) {
        setNow(Date.now());
        void refresh();
      }
    }, 1000);
    const listener = AppState.addEventListener("change", () => {
      void refresh();
    });
    const startup = setTimeout(() => void locate(), 0);
    return () => {
      live = false;
      clearTimeout(startup);
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  async function command<T>(fn: () => Promise<T>): Promise<T | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      const result = await fn();
      setError("");
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      await refresh();
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    data,
    ready,
    busy,
    storageError,
    status,
    fix,
    now,
    background,
    recovered: false,
    permissionBlocked: status.includes("denied"),
    locate,
    start: () =>
      command(async () => {
        await requestTrackingPermission();
        await startRecording();
      }),
    finish: () => command(finishRecording),
    saveBike: (bike: Bike) => command(() => saveBikeDetails(bike)),
    canStart: ready && !busy && !!fix && validFix(fix, now),
    retrySave: () => refresh(),
  };
}
