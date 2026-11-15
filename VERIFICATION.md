# Four-tab major update verification, 2026-11-14

This section supersedes historical implementation-status claims below.

- Baseline master was 364cf6fc6f6c109aabb9faa4b43bbbdb4349d160. Remote preview/four-tab was 80ca75c471adf4411dc4859fb741931b70c94e79. Only the latter contained Today/Friends/Garage/Ranks.
- Implemented Home/Friends/Garage/Profile through Expo Router with app-lifetime recorder/group providers and tracking imported before router registration. Original @emoto/v1 data and @emoto/tracking-v1 state remain readable.
- TypeScript and lint pass. All 42 Node/PGlite tests pass. All five Playwright checks pass, including legacy draft/history/build persistence, navigation and Finish, plus Finish/Stop while friend uploads are stalled.
- iOS, Android, and web exports pass. Live Metro browser navigation on port 8081 passes all four screens at 390x844 and Home at 1280x900, with zero page errors. Public tunnel health, iOS manifest identity, and served full iOS bundle feature strings are verified.
- Hosted E-Moto Supabase now has additive repride_social_foundation and repride_serialize_privacy_updates migrations. Hosted checks cover private default, follow versus accepted friendship, feeds, publication stats, presence/stop, hide, blocking, malformed builds, and concurrent privacy/publish operations. Temporary QA auth users and their data were removed.
- Privacy mutations and publication/presence checks serialize on the same profile-row lock. Client route filtering preserves segment gaps and excludes endpoint distances, endpoint areas, and zones. New privacy zones clear previously shared routes and revoke presence before local activation. Old-revision uploads fail. Friend networking runs outside the recorder command queue, coalesces requests, and backs off after completion.
- New recordings optionally capture GPS-estimated moving seconds, moving distance, and top speed. Moving segments require at least 1 m/s and an accepted same-segment fix. Older rides retain unavailable measurements. Shared payloads contain date, permitted stats, and coordinate-only sanitized segments.

Preview choices made for this increment are 15-minute explicit friend sharing with a 30-second server lease, first-ride/10-mile achievements, the existing device-scoped anonymous identity, and the existing native map provider. Reference bike photography is labeled.

Physical iPhone/Android GPS, background delivery, locked-screen reliability, two-phone group/friend behavior, keyboard/safe-area behavior, and native map rendering remain unverified. Automatic ride detection, wheelie sensing, photo/video posting, recoverable accounts, actual leaderboards, and licensed Specd 3D remain pending. Expo Go preview supports foreground testing.

## Historical milestone record

# Ride milestone verification

One code review/fix pass completed. Existing monochrome styling retained using the existing Impeccable guidance; no decorative reference assets selected.

Fixed Windows-1252 source bytes in App.tsx and useRecorder.ts by converting to UTF-8. Added an encoding regression test and .editorconfig. Fixed stationary sampling: ignored jitter now refreshes lastFixAt so a long stationary pause with fresh GPS does not cause a false route gap. Movement must exceed the larger reported point uncertainty (minimum 4m). This intentionally undercounts some small movements and still requires outdoor tuning.

Garage now uses KeyboardAvoidingView with a scrolling form, handled taps and drag-to-dismiss. Android native configuration explicitly requests resize. Expo Go supplies its own native configuration; verify both Expo Go behavior and the eventual development build.

Checks actually run:

- TypeScript: passed.
- 15 Node tests: passed. Distance, accepted movement, stationary noise, long stationary pauses, stale/poor fixes, jump rejection, duplicate timestamps, route gaps, duration formatting, UTF-8 source, storage reload of route/stats/bike, ordered checkpoints, failed-write recovery, corrupt data rejection.
- Expo dependency compatibility: up to date.
- Expo Doctor: 20/20 checks passed.
- Android, iOS and web exports: passed. Exporting is not runtime interaction verification.
- Code inspection: the recorder hook is mounted above the conditional tab screens. Its current ride survives tab changes. Start/Finish use a synchronous ref lock before awaiting a write, recheck draft presence and deduplicate completed ride IDs. These protections were inspected, not tested by physical taps or hook integration tests.

**Not visually checked.** No browser interaction session or native device/simulator session was run. Keyboard-open Garage reachability, safe areas, native route rendering, real GPS drift, touch repetition, OS restart persistence and permission flows still need device verification. Storage tests use the production serializer/queue with an in-memory adapter; they do not validate the device's AsyncStorage implementation.

Physical-device checklist (both iOS and Android):

1. Grant precise foreground location outdoors. Confirm readable GPS accuracy/status text and location marker. Stand still for 60 seconds; distance should remain near zero, not climb continuously.
2. Tap Start repeatedly. Walk 100-200m with screen awake; verify one active ride, growing route/distance and timer. Switch among all three tabs and return; recording must continue.
3. Briefly background/lock the app, then return. Verify explicit interruption/recovery and a disconnected route gap. This milestone does not record background travel.
4. Tap Finish repeatedly. Verify exactly one saved ride. Note route/distance/duration, terminate and relaunch, then reopen it and compare. Start another ride and terminate/relaunch to check draft recovery.
5. Save bike details, terminate/relaunch, verify the same values. At larger text size on a small phone, focus each Garage field, scroll with keyboard open and tap Save; confirm saved feedback and no obscured action.
6. Deny/revoke permission and disable GPS while recording. Confirm truthful interruption and successful retry. Check poor-signal conditions outdoors where safe.

See BACKGROUND-BUILD.md for the next milestone's exact configuration and lifecycle work. Background tracking is not enabled here. The prior three moderate Expo transitive audit findings remain unresolved; no forced SDK downgrade was applied.
