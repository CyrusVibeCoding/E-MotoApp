# E-Moto — first milestone

Current remote foreground testing: follow [REMOTE-TESTING.md](REMOTE-TESTING.md) for Ario's clone/setup instructions, account matching, shared backend configuration and two-phone checks. Earlier deployment-pending notes below are historical; current backend Auth settings are recorded in that handoff.

Group rides: see [GROUP-RIDES.md](GROUP-RIDES.md) for backend setup, current checks and the two-phone checklist. Hosted group functionality is pending project confirmation; recording/history/Garage remain local.


The original coffee website in the parent folder is preserved. Run all commands below from `emoto/`.

## Launch on a phone

Use Node 22.13+ (or a supported newer LTS) and npm. Install the SDK 58 version of Expo Go from https://expo.dev/go (the current installer listed SDK 58 when this app was created). Both phones must use a matching Expo Go SDK; update Expo Go if it reports a mismatch.

```powershell
cd emoto
npm ci
npx expo start --go
```

Connect computer and phone to the same Wi-Fi. Scan the QR with Camera on iPhone or Expo Go on Android. Allow local-network access/firewall access if requested. If LAN is blocked, try `npx expo start --go --tunnel` (Expo may ask to install tunnel tooling). Windows can serve both phones; Xcode is not required for Expo Go.

## Short-walk acceptance test

1. Open outdoors. Grant precise location while using the app. Wait for GPS ready. Verify your position on the native map. Deny permission once to check the recovery copy, then enable it in system settings and retry.
2. Tap Start ride several times quickly. Only one ride should start. Walk 100–200 m, keeping the app open and screen awake. Time should advance, distance should rise, and a black route should appear. Very short movement may be filtered as GPS noise.
3. Briefly leave the app or lock the screen. Return and verify tracking reconnects with a route gap, rather than joining the missing travel. Elapsed time includes the gap; distance excludes it. Switch tabs during recording; the ride must remain active.
4. Finish repeatedly. Verify one summary and one saved history item. Reopen it in Rides. Close/relaunch the app and confirm the ride remains. Start another ride and terminate the app; relaunch to check unfinished-ride recovery.
5. Save make, model and nickname in Garage. Relaunch and verify persistence. Try blank values and larger system text. Check portrait, landscape and safe areas on both phones.
6. Turn GPS off or revoke permission while recording. Verify an interruption message and recovery via Retry location. Test low-signal conditions and denied storage/device-full behavior on a test device where practical.

## Behavior and limitations

- Foreground only. Keep the screen awake yourself. App backgrounding removes the location subscription and resumes with a new segment on return. Background travel is intentionally omitted.
- Fixes older than 15 seconds, worse than 35 m accuracy, or with invalid coordinates are rejected. Tiny movement is filtered to reduce jitter; jumps over 45 m/s are rejected. These thresholds need field tuning; this is not a precision navigation instrument.
- Distance is kilometers with two decimals; duration is HH:MM:SS and includes interruptions. GPS estimates can undercount or drift.
- Local AsyncStorage uses one versioned document and serialized writes. Accepted points checkpoint the unfinished ride. A finished ride replaces its draft only after successful saving. Writes are not a guarantee against OS termination during a pending write. No cloud sync/export or encryption. Uninstalling/clearing app data deletes records. Corrupt/unreadable storage blocks recording rather than overwriting existing records.
- Web supports layout/forms/history preview; native maps and recording require iOS/Android. No fabricated map or sample rides are shown.
- Future background tracking requires a development build, background permissions and native configuration, TaskManager tasks, Android foreground-service behavior, and separate battery/privacy/device testing. Expo Go is not the background-tracking validation target.
- Future standalone Android builds need Google Maps API configuration; Expo Go supplies its own native environment. Bike photography, profile, nearby spots and social rides are outside this milestone.

## Collaboration and checks

`App.tsx` owns screens and shared controls; `src/useRecorder.ts` owns permissions and recording lifecycle; `src/ride.ts` owns GPS math/filtering; `src/storage.ts` owns serialized persistence; `src/RouteMap.tsx` owns native maps (`.web.tsx` is an explicit fallback). Keep changes scoped to these boundaries when using VS Code Live Share. Do not commit secrets or native map API keys.

```powershell
npm run typecheck
npm test
npx expo install --check
npx expo-doctor
npx expo export --platform all
```

Automated tests cover distance math, stale/poor fixes, jitter, duplicate timestamps, GPS jumps, gaps and duration formatting. They do not substitute for the physical acceptance test above. No browser automation or native simulator was available in this session: **Not visually checked.** Desktop/narrow layout, touch, screen readers, GPS, native map rendering and relaunch persistence still require runtime verification.

Dependency audit reported three moderate findings in Expo's transitive `@expo/fingerprint`/`minimatch` chain. npm's proposed force fix downgrades Expo to SDK 52; it was not applied because it breaks SDK compatibility. Recheck upstream updates before release.

Design guidance used: Impeccable, applied to the supplied monochrome brief. No bundled effects or licensed reference fonts were copied. The optional mechanical design detector could not scan the Windows path (reported ENOENT although PowerShell confirmed the file exists); no detector pass is claimed.
