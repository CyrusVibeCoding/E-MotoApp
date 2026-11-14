import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState, Platform } from "react-native";
import { readData, writeData } from "./storage";
import { groupRequest } from "./groupApi";
import type { GroupSession } from "./groupModel";
import type { Bike, Point } from "./ride";
import { validFix } from "./ride";
import { needsTracking, recordBatch } from "./trackingCore";
const TASK = "emoto-location-v1";
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const KEY = "@emoto/tracking-v1";
type State = {
  group: GroupSession | null;
  pendingLeave: string | null;
  fix: Point | null;
  status: string;
  groupMessage: string;
  syncedAt: number;
  background: boolean;
};
const initial: State = {
  group: null,
  pendingLeave: null,
  fix: null,
  status: "Finding your location...",
  groupMessage: "",
  syncedAt: 0,
  background: false,
};
let queue: Promise<unknown> = Promise.resolve();
let watch: Location.LocationSubscription | null = null;
// One JS runtime owns both TaskManager callbacks and UI commands. All persisted
// read/modify/write and network operations are serialized through this queue.
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.catch(() => {}).then(fn);
  queue = result;
  return result;
}
async function state(): Promise<State> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...initial, ...JSON.parse(raw) } : { ...initial };
}
const save = (s: State) => AsyncStorage.setItem(KEY, JSON.stringify(s));
let nextAttempt = 0;
async function sync(s: State) {
  if (!s.pendingLeave && Date.now() < nextAttempt) return;
  nextAttempt = Date.now() + 5000;
  try {
    if (s.pendingLeave) {
      await groupRequest("leave", { group_id: s.pendingLeave });
      s.pendingLeave = null;
    }
    if (s.group) {
      const result = await groupRequest("sync", {
        group_id: s.group.id,
        location: s.fix && validFix(s.fix, Date.now()) ? s.fix : null,
      });
      if (result.error) {
        s.groupMessage = result.error;
        if (result.expired) s.group = null;
        s.syncedAt = 0;
      } else {
        s.group = result;
        s.syncedAt = Date.now();
        s.groupMessage = "";
      }
    }
  } catch {
    nextAttempt = Date.now() + 15000;
    s.syncedAt = 0;
    s.groupMessage =
      "Connection lost. Sharing interrupted; retrying on the next update.";
  }
  await save(s);
}
export function ingest(locations: Location.LocationObject[]) {
  return exclusive(async () => {
    const s = await state();
    const now = Date.now();
    const points: Point[] = locations.map((l) => ({
      ...l.coords,
      timestamp: l.timestamp,
      accuracy: l.coords.accuracy ?? Infinity,
      segment: 0,
    }));
    const latest = [...points]
      .sort((a, b) => b.timestamp - a.timestamp)
      .find((p) => validFix(p, now));
    if (latest && (!s.fix || latest.timestamp > s.fix.timestamp))
      s.fix = latest;
    s.status =
      s.fix && validFix(s.fix, now)
        ? "GPS ready"
        : "GPS interrupted. Waiting for a fresh accurate fix.";
    const data = await readData();
    await writeData(recordBatch(data, points, now));
    await save(s); // Local ride checkpoints precede networking.
    await sync(s);
    await reconcile(s);
  });
}
if (Platform.OS !== "web" && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    TASK,
    async ({ data, error }) => {
      if (error) {
        await exclusive(async () => {
          const s = await state();
          s.status = `Tracking interrupted: ${error.message}`;
          await save(s);
        });
        return;
      }
      if (data) await ingest(data.locations);
    },
  );
}
async function reconcile(s: State) {
  const data = await readData();
  const needed = needsTracking(!!data.draft, !!s.group);
  const available =
    Platform.OS !== "web" && !isExpoGo && (await TaskManager.isAvailableAsync());
  const granted =
    available && (await Location.getBackgroundPermissionsAsync()).granted;
  if (needed && granted) {
    watch?.remove();
    watch = null;
    if (!(await Location.hasStartedLocationUpdatesAsync(TASK)))
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 0,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "E-Moto location active",
          notificationBody:
            "Recording or group sharing is enabled. Open E-Moto to stop.",
          killServiceOnDestroy: true,
        },
      });
    s.background = true;
  } else {
    if (available && (await Location.hasStartedLocationUpdatesAsync(TASK)))
      await Location.stopLocationUpdatesAsync(TASK);
    s.background = false;
    if (needed && AppState.currentState === "active" && !watch)
      watch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 2,
        },
        (locations) => {
          void ingest([locations]).catch(() => {});
        },
      );
    if (!needed || AppState.currentState !== "active") {
      watch?.remove();
      watch = null;
    }
  }
  await save(s);
}
export function refreshTracking(network = false) {
  return exclusive(async () => {
    const s = await state();
    if (network) await sync(s);
    await reconcile(s);
    return { data: await readData(), tracking: s };
  });
}
export async function requestTrackingPermission() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted)
    throw Error("Location permission is denied. Enable it in system settings.");
  if (Platform.OS !== "web" && !isExpoGo && (await TaskManager.isAvailableAsync()))
    await Location.requestBackgroundPermissionsAsync();
  // Denial still permits foreground recording; the UI explicitly labels it.
}
export async function locateOnce() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted)
    throw Error("Location permission is denied. Enable it in system settings.");
  await ingest([
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }),
  ]);
}
export const startRecording = () =>
  exclusive(async () => {
    const data = await readData();
    const s = await state();
    if (data.draft) return;
    if (!s.fix || !validFix(s.fix, Date.now()))
      throw Error("Wait for a fresh GPS fix before starting.");
    const startedAt = Date.now();
    await writeData({
      ...data,
      draft: {
        id: String(startedAt),
        startedAt,
        points: [{ ...s.fix, timestamp: startedAt }],
        meters: 0,
      },
    });
    await reconcile(s);
  });
export const finishRecording = () =>
  exclusive(async () => {
    const data = await readData();
    if (!data.draft) return null;
    const ride = { ...data.draft, endedAt: Date.now() };
    await writeData({
      ...data,
      draft: null,
      rides: [ride, ...data.rides.filter((r) => r.id !== ride.id)],
    });
    await reconcile(await state());
    return ride;
  });
export const saveBikeDetails = (bike: Bike) =>
  exclusive(async () => {
    await writeData({ ...(await readData()), bike });
    return true;
  });
export const enterGroup = (
  action: "create" | "join",
  name: string,
  code: string,
) =>
  exclusive(async () => {
    const s = await state();
    if (s.group) return;
    if (s.pendingLeave) {
      await sync(s);
      if (s.pendingLeave)
        throw Error("Reconnect to finish leaving the previous group.");
    }
    const result = await groupRequest(action, {
      name: name.trim(),
      code: code.trim().toUpperCase(),
    });
    if (result.error) throw Error(result.error);
    s.group = result;
    await save(s);
    await reconcile(s);
    await sync(s);
  });
export const leaveGroup = () =>
  exclusive(async () => {
    const s = await state();
    s.pendingLeave = s.group?.id ?? s.pendingLeave;
    s.group = null;
    s.syncedAt = 0;
    await save(s);
    await reconcile(s);
    await sync(s);
  });
