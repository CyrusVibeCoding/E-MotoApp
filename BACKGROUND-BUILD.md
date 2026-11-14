# Background tracking implementation and device validation

This replaces the prior foreground-only plan. SDK 58 expo-task-manager and expo-dev-client are installed. The location plugin enables iOS background location, Android background permission and foreground service. A module-scope task is imported before app registration. No cloud build, paid service or signing credential was created in this session.

## Ownership and behavior

src/tracking.ts is the single owner of location updates, local ride mutations and group session mutations. Both hooks call this owner rather than keeping competing ride snapshots. Its serialized queue reads durable state before every mutation. The native background task is preferred while recording OR sharing; if unavailable/denied, a foreground-only watch is used. When neither is needed, task and watch stop. Idle map positioning is a one-shot request, not continuous tracking.

Task batches and fallback foreground fixes use trackingCore.recordBatch and the existing appendPoint/accuracy/jitter logic. Timestamp deduplication prevents overlap from counting twice. Delayed batches can contribute to the recorded route; only fresh fixes may be displayed/shared as live. Local ride writes precede network calls. Network calls time out and back off; controls can wait for an already-running write/network operation. Do not force-close while Save/Finish is pending.

Ride intent, group membership/consent, last fix and pending Leave are durable. Reopening reconciles these with native task registration; a still-valid joined session resumes previously authorized sharing. Finish clears only recording; Leave clears only sharing. If both were enabled, the other continues. Old routes, durations, bike records and the storage key/version remain intact. This relies on Expo's single application JS runtime for UI and TaskManager callbacks; no separate native service or independently launched JS writer is supported.

The current Supabase lease remains 90 seconds. OS-delayed delivery or a connection outage can expire a membership even with background permission. The app shows expiry and requires explicit rejoin; it cannot guarantee continuous membership or a five-second background heartbeat. Stale fixes are never replayed as live on reconnect. A pending offline Leave retries when callbacks/app execution resume, otherwise server expiry removes visibility. Last-known positions can remain for the lease window.

## Install on both phones

1. Use Node/npm in C:\Users\cyrus\OneDrive\Desktop\coffeeshop\emoto. Run npm ci. Both phones need this project's development build, not Expo Go.
2. app.json supplies development identifiers com.emoto.rides for both platforms. Confirm these are suitable for your Apple/Google accounts before distributing. Run npx.cmd eas-cli@latest login, then npx.cmd eas-cli@latest build:configure and retain the generated EAS project linkage. eas.json already defines developmentClient:true and internal distribution.
3. Configure the EAS development build environment with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local. The ignored local file is not automatically included in a cloud build. Never upload a service-role key. Confirm anonymous sign-in is enabled in Supabase.
4. For Android native maps, enable Google Maps SDK for Android and configure GOOGLE_MAPS_ANDROID_API_KEY in the build environment. app.config.ts passes it to react-native-maps. Restrict the key to the package and development signing certificate. iOS uses Apple Maps by default.
5. Android: npx.cmd eas-cli@latest build --platform android --profile development. Install the resulting APK on each Android phone (allow installation from that trusted download when prompted).
6. iPhone: Apple Developer membership is needed for internal physical-device distribution. Register each device using npx.cmd eas-cli@latest device:create, then npx.cmd eas-cli@latest build --platform ios --profile development. Install from the returned link and enable Developer Mode if prompted. EAS cloud builds can be requested from Windows.
7. Run npx.cmd expo start --dev-client --clear. Open E-Moto's installed development client on the same Wi-Fi and connect to Metro. Rebuild after native dependency/plugin changes. Grant precise foreground location first, then Always/background access when requested at Start/Create/Join. On Android, explain/complete the OS Settings step if shown. If denied, the UI labels foreground-only tracking; use system settings then Retry location.

## Device checklist (iOS and Android)

- Record alone: start outdoors, walk with screen locked for 2-5 minutes, return, inspect route/time/distance and verify no duplicated segment. Finish and relaunch; compare saved summary. Try rapid Start/Finish taps.
- Share alone: join a group on two phones with explicit consent, lock one, keep walking; verify remote names, timestamps and Live/Last known behavior. No local ride should be created merely by sharing.
- Both: record/share, lock, return, Finish. Verify sharing continues. Start another ride, Leave, verify recording continues. Finish remaining ride; confirm Android service notification/location indicator ceases when both demands are off.
- Disconnect network for under/over 90 seconds. Local route must survive. On reconnect, fresh positions only; expired memberships require rejoin. Leave offline, restore network and confirm removal/expiry on the other phone.
- Deny background permission, revoke precise/all location permission, disable GPS and return to app. Verify foreground-only/interruption copy and retry. No permission should imply false live sharing.
- Repeat with stationary pauses, low-signal areas, battery saver and a 30-60 minute ride. Compare battery drain and device heat to idle. High-accuracy location consumes substantial battery; do not call the five-second request a delivery guarantee.
- Force-quit/force-stop, relaunch and check saved draft and session expiry. iOS force-quitting stops background execution; Android force-stop also stops tracking, and recent-app removal varies by vendor. killServiceOnDestroy is enabled deliberately. No travel while terminated is promised or recoverable from GPS; relaunch can resume only from newly received fixes.
- Check small screens, large text, keyboard-open forms, status text and permission prompts. Native map attribution/controls must stay visible.

## Evidence and limits

Automated checks cover pure batch deduplication, delayed/ordered processing, no draft recreation after Finish, independent tracking demands, existing GPS filters and storage/group SQL rules. These are not OS lifecycle or integration tests. Native service registration, screen-lock delivery, force-close behavior, battery impact and real network reconnects require the checklist above. No development binary was built/installed in this session. Not visually checked for this change.

Current documentation consulted: https://docs.expo.dev/versions/v58.0.0/sdk/location/ , https://docs.expo.dev/versions/v58.0.0/sdk/task-manager/ , https://docs.expo.dev/build/eas-json/ . Expo documents development-build requirements and OS termination limits; background tracking is best effort, not guaranteed navigation or emergency tracking.

Verification results for this implementation: 30 Node/PostgreSQL tests passed; TypeScript passed; lint completed with zero errors and one hook-lifecycle warning; Expo Doctor passed 20/20. Final Android/iOS/web exports succeeded. Two Chrome interaction tests passed at 390x844 and 1280x900 (group form, tab navigation and Garage persistence after reload). Rendered Map/group form screenshots were actually inspected at both widths: the controls remain in the existing scrollable monochrome panel. These web checks do not test native background execution. Native UI and background delivery: Not visually checked. No physical device/simulator or EAS build was run. Eight moderate transitive dependency audit findings remain from Expo/ESLint tooling.
