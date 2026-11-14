import type { Data } from "./storageCore";
import { appendPoint, validFix } from "./ride.ts";
import type { Point } from "./ride";
// Pure reducer shared by native task and foreground fallback. Duplicate timestamps
// are rejected by appendPoint even when both providers deliver the same fix.
export function recordBatch(data: Data, points: Point[], now: number): Data {
  if (!data.draft) return data;
  let draft = data.draft;
  for (const p of [...points].sort((a, b) => a.timestamp - b.timestamp)) {
    // OS-delivered batches may be delayed. Validate accuracy/coordinates at the
    // fix time for recording; live sharing still requires a fresh current fix.
    if (p.timestamp < draft.startedAt || p.timestamp > now + 5000 || !validFix(p, p.timestamp)) continue;
    draft = appendPoint(draft, {
      ...p,
      segment: draft.points.at(-1)?.segment ?? 0,
    });
  }
  return { ...data, draft };
}
export const needsTracking = (recording: boolean, sharing: boolean, friends = false) =>
  recording || sharing || friends;
