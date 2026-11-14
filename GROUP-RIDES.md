# Group rides: setup and verification

The app previously had no backend. The implementation uses Supabase anonymous Auth identities and an authenticated RPC for session membership and foreground location exchange. No password is required for riders. Local recording/history/Garage continue to work without configuring the backend.

## Backend account setup

A connected Supabase project was discovered, but no destination has been confirmed. No hosted schema or Auth settings were changed. Confirm the intended project before applying these files; they create new objects under `emoto_private` and a public `emoto_group` function. Do not expose `emoto_private` as a Data API schema.

1. Select/create a Supabase project you own. Enable anonymous sign-ins under Authentication settings. Keep Auth rate limits enabled; configure anti-abuse measures appropriate to a public launch. Anonymous signups create stored Auth users; budget for this and establish an Auth-user retention policy before release.
2. Review and run `backend/group.sql` once in the project's SQL editor as its database owner. It is a first-install schema, not an idempotent update script. Enable Supabase Cron (`pg_cron`), then run `backend/schedule.sql` once. Confirm the `emoto-group-cleanup` job runs successfully every minute. No Realtime publication is needed: this version polls every five seconds.
3. Copy `.env.example` to `.env.local`, and set the project URL and publishable key from the project's API settings. These values are deliberately public; never put service-role/secret keys in an Expo variable. Restart Metro with `npx expo start --go --clear`. Both phones must use the same project.
4. Test Auth and RPC access on the real project, and run Supabase's database security advisors before inviting riders. Local PostgreSQL tests cannot verify hosted Auth settings, API grants, networking or Cron installation.

## Using the feature

On Map, open **Ride together**, enter a display name, explicitly agree to group-only foreground sharing, then create or enter an eight-character invite code. Share codes only with trusted riders: possessing the code allows another authenticated rider to join (up to 20 members). Display names are labels, not verified identities.

The same existing GPS subscription supplies recording and group sharing. Sharing works without starting a recorded ride; Start/Finish only control the local recording. Finishing a recorded ride does **not** leave a group. Use **Leave group and stop sharing** separately. Group state lives above the tabs, so switching tabs does not stop sharing or recording. No new navigation destination is introduced.

Each map marker includes the rider's name and Live/Last known label. Tap it for the location timestamp; the expanded group panel lists all riders, including those awaiting GPS. Map exploration no longer snaps back on every fix. Use the location control to return to yourself. The web map remains a placeholder; native map validation needs phones.

## Privacy, access and expiry

- Only authenticated members of the same unexpired session receive that session's riders. Tables have RLS enabled, no permissive policies, and no client table grants. The public SECURITY INVOKER wrapper calls a tightly scoped SECURITY DEFINER handler in the non-exposed schema. The handler derives identity from `auth.uid()`; clients cannot choose who owns an update.
- The RPC accepts only create/join/sync/leave. Raw tables, invite lists and other groups are inaccessible. Joins/creates are serialized per identity and limited to ten attempts/minute/identity. Keep anonymous Auth/IP rate limiting enabled; this is not exhaustive public abuse protection.
- Polling/heartbeats run every five seconds while foregrounded. Fresh valid GPS fixes (at most 15 seconds old, at most 35m accuracy) are shared. No route history or Garage data is uploaded. Server and observation timestamps are retained; a marker is Live only while connected, sharing, and observed within 20 seconds. Backgrounding/denied GPS gives last-known positions; missing GPS never fabricates a location.
- Membership expires after 90 seconds without a heartbeat. The server enforces expiry on every request; an expired membership cannot be revived by a sync. Rejoin explicitly with a code if the group still exists. Groups expire after 12 hours regardless of activity. The scheduled cleanup deletes expired/empty groups and location rows; deleting a group cascades to memberships. Last-known location is visible only while the membership remains active.
- Leave immediately invalidates client responses, removes the local group and stops uploads. The authenticated server delete is idempotent and removes only the caller. Offline leave is saved as a pending removal and retried after reconnect/relaunch before another join. Previously sent locations may remain visible to peers for the 90-second lease plus their next poll. Already in-flight updates cannot recreate membership after deletion.
- App restart does not automatically resume group sharing. Anonymous Auth persists, but the rider must create/join and consent again. An old membership times out; a retry can reuse the identity's still-active group. Uninstalling loses anonymous identity. No location cache is persisted by the client; only a pending group ID is stored for leave retries.

## Two-phone checklist

1. Configure the same project on A/B. Give different names. On A consent/create; on B consent/join its code. Verify names, both positions and update timestamps on both maps. Try wrong/expired codes and blank names.
2. Walk with both phones foregrounded. Verify positions update within roughly 5-15 seconds. Start a local recording on A, switch tabs, return, finish and reopen the local history item. Confirm group sharing survives Finish; Garage/history still persist after restart.
3. Disable precise location/deny permission on B. Verify readable recovery and Waiting for GPS/Last known status, never Live indefinitely. Restore GPS and retry location. Do not infer actual coordinate freshness from network connectivity alone.
4. Disconnect B's network. Verify reconnecting on B and aged last-known on A. Restore within 90 seconds and verify recovery; after 90 seconds expect explicit session expiry and rejoin. Background B to verify foreground-only behavior.
5. Leave on B while online: confirm immediate local removal and disappearance on A after its next poll. Attempt further sync/read using B's former membership: it must be rejected. Leave while offline: no more location uploads; reconnect/relaunch and verify removal retry. Confirm A loses B after lease expiry even if B never reconnects.
6. With a third independent identity, try reading/updating a group by UUID without joining. It must return expired/unauthorized. Try setting another member's user_id in a sync payload: only the caller may change. Do not run these tests against strangers' sessions.
7. Stop all heartbeats. Verify membership denial after 90 seconds and empty-group deletion by Cron. In a test project, expire a group and confirm its code cannot join, all locations are deleted and current clients show expiry.
8. On small phones and larger text, check the group form with the keyboard open, markers, map attribution, location button and Leave action. Test iOS and Android.

## Checks and limits

`npm test` includes the existing recorder/storage tests plus group-model tests and actual PostgreSQL (PGlite) schema/RPC tests using mocked Supabase Auth claims. SQL tests cover outsiders, caller-only updates, idempotent creation/leave, invalid codes/rate limiting, membership expiry, hard expiry, table access and cleanup. They do not simulate Supabase JWT verification or a two-device network.

No hosted deployment, real two-phone test or background sharing is claimed. A confirmed backend destination and enabled anonymous Auth are required for connected functionality. Background tracking remains a separate development-build milestone described in BACKGROUND-BUILD.md.

### Actual results

- 26 Node/PostgreSQL tests passed, including all prior ride/storage checks. TypeScript passed; Expo dependencies are compatible; Expo Doctor passed 20/20.
- Lint: zero errors, four hook-lifecycle warnings (two in the existing recorder, two in the group hook). These effects own lifetime subscriptions using refs; hook integration tests remain future work.
- Android, iOS and web exports succeeded after the review/fix pass.
- Two Playwright/Chrome tests passed at 390x844 and 1280x900: unconfigured group setup message, tabs, bike saving, persistence after browser reload, empty history and no browser page errors. Connected create/join flows were not exercised in a browser.
- Rendered Map and Garage screenshots were actually inspected at both widths. The existing styling, readable text, scrolling and actions were reviewed. Ambiguous accessible tab names found during automation were fixed. Native markers and software-keyboard behavior are **Not visually checked** on iOS/Android.
- Impeccable detector on GroupPanel.tsx returned no findings. Existing tokens were retained; no bundled reference media was selected.
- npm audit: eight moderate transitive findings in Expo/minimatch and ESLint tooling. Nonbreaking audit fix did not resolve them; the suggested forced SDK 52 downgrade was not applied.

Rerun browser checks with `npx expo export --platform web` followed by `npx playwright test`. Chrome is required. Tests target the unconfigured backend state: unset EXPO_PUBLIC_SUPABASE variables for that export. Generated screenshots/reports live in ignored test-results/.

## Hosted deployment update

Deployed to E-Moto (`jqlxsbllaldlgixcoxdc`): group schema/RPC and pg_cron cleanup every minute. `.env.local` now contains this project's URL and publishable key (ignored by Git). Hosted transactional create/join/outsider/leave checks passed and rolled back all test records. Direct member-table SELECT and unauthenticated RPC access were confirmed denied. TypeScript passed; lint has zero errors and the same four lifecycle warnings.

Remaining setup: enable Anonymous Sign-Ins in the project's Authentication settings. The public Auth settings endpoint reports anonymous_users=false; connected tools do not expose changing that setting. No end-to-end anonymous sign-in or two-phone test has passed yet. Security advisors report only three informational RLS-without-policy notices on deliberately private, default-deny tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

After enabling anonymous sign-ins, restart Metro with `npx.cmd expo start --go --clear` and follow the two-phone checklist above. This update supersedes the earlier project-confirmation/deployment-pending statements in this document.

Background milestone update: location ownership has moved to src/tracking.ts and a module-scope TaskManager task. See BACKGROUND-BUILD.md for current behavior, build setup and limits. It supersedes this document's earlier foreground-only lifecycle descriptions. Existing group server leases/access rules are unchanged.
