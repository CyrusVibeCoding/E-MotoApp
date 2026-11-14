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
