import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { groupConfigured } from "./groupApi";
import type { GroupSession } from "./groupModel";
import type { Point } from "./ride";
import {
  enterGroup,
  leaveGroup,
  refreshTracking,
  requestTrackingPermission,
} from "./tracking";
export function useGroupRide(_fix: Point | null, _gpsStatus: string) {
  const [group, setGroup] = useState<GroupSession | null>(null),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [message, setMessage] = useState(""),
    [clock, setClock] = useState(Date.now);
  const lock = useRef(false);
  async function refresh() {
    try {
      const { tracking: s } = await refreshTracking(true);
      setGroup(s.group);
      setConnected(s.syncedAt > Date.now() - 20000);
      setMessage(s.groupMessage);
      setClock(
        Date.now() +
          (s.group && s.syncedAt
            ? Date.parse(s.group.server_time) - s.syncedAt
            : 0),
      );
    } catch (e) {
      setConnected(false);
      setMessage(String(e));
    }
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 5000);
    const startup = setTimeout(() => void refresh(), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(startup);
    };
  }, []);
  async function command(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(String(e));
    } finally {
      lock.current = false;
      setBusy(false);
      await refresh();
    }
  }
  return {
    group,
    busy,
    connected,
    message,
    configured: groupConfigured,
    serverNow: clock,
    sharing:
      !!group &&
      connected &&
      !!_fix &&
      _gpsStatus === "GPS ready" &&
      clock - _fix.timestamp < 20000,
    enter: (action: "create" | "join", name: string, code = "") =>
      command(async () => {
        if (!name.trim()) throw Error("Enter a display name.");
        await requestTrackingPermission();
        await enterGroup(action, name, code);
      }),
    leave: () => command(leaveGroup),
  };
}
