# RepRide remote two-phone test

Inspected 2026-11-13. Run these commands from the mobile app repository root (currently `coffeeshop/emoto`, not its parent coffee website). This is the current foreground Expo Go handoff; older setup/deployment-pending notes in README/GROUP-RIDES are historical. No new backend or Expo project is needed.

## Verified configuration

- npm: `package-lock.json`, no Bun/Yarn/pnpm lockfile. Use `npm ci`.
- Installed Expo `58.0.25`; resolved SDK `58.0.0`, React Native `0.88.1`, React `19.3.0`. `expo install --check` passes.
- Resolved owner `repride`, slug `cyrus`, EAS project ID `fe675c6f-c5c1-45c0-9dd7-abef2d300cd0` (`@repride/cyrus`). Display name remains E-Moto. Remote ownership/build records were not queried.
- Local Expo CLI is signed in as `cyrusclaude`. Each iPhone must sign in to the same Expo account as its own hosting computer. Organization membership alone is insufficient.
- `src/groupApi.ts` reads exactly the two EXPO_PUBLIC variables in `.env.example`, persists a separate anonymous Supabase identity per installation, and calls `emoto_group`. Expo login does not identify a rider to Supabase.
- Local `.env.local` targets `https://jqlxsbllaldlgixcoxdc.supabase.co` and contains an `sb_publishable_` client key. It is ignored and untracked. Public Auth settings returned HTTP 200, `external.anonymous_users=true`, `disable_signup=false` today.
- Unauthenticated REST schema discovery returned HTTP 401; hosted authenticated RPC behavior was not retested today. Older hosted transactional results are recorded in GROUP-RIDES.md.
- Current code explicitly disables background TaskManager use in Expo Go and falls back to a foreground watch. Finish and Leave control recording and sharing independently.

## Before Ario clones

The shared repository is https://github.com/cyrusvibecoding/e-motoapp, using the `master` branch. The mobile app lives at the repository root. Do not commit `.env.local`, dependencies, generated exports or credentials.

Both developers should use the same pushed test commit (`git rev-parse HEAD`). After cloning, run all setup commands in the clone root; no additional `emoto/` directory is needed.

## Ario: clone, configure, launch

Install Git and a supported Node LTS with npm (Node 24 LTS, at least 24.3, or Node 22 at least 22.13). Local checks here used Node 26.13.0/npm 11.20.0. Do not upgrade Expo to resolve a phone version mismatch without coordinating.

```powershell
git clone --branch master https://github.com/cyrusvibecoding/e-motoapp.git repride
cd repride
git rev-parse HEAD
node --version
npm --version
npm ci
Copy-Item .env.example .env.local
```

Copy the existing project's publishable key from Cyrus or the Supabase dashboard into `.env.local`; retain the template's existing backend URL. Only copy the file on first setup; do not overwrite an already configured `.env.local`. macOS/Linux equivalent: `cp .env.example .env.local`.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://jqlxsbllaldlgixcoxdc.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_EXISTING_PROJECT_PUBLISHABLE_KEY
```

EXPO_PUBLIC values are bundled into the app and readable by its users. Use only a publishable key, never a service-role/secret key, database password or signing secret. A publishable key does not replace server authorization. `.env.example` is safe to commit; actual env files are ignored. The native Android Maps build key is unnecessary for Expo Go. Do not run backend SQL again or change the EAS linkage.

```powershell
git check-ignore .env.local
npm run typecheck
npm run lint
npx expo install --check
npx expo login
npx expo whoami
npx expo start --go --tunnel --clear
```

On Windows, if PowerShell blocks npm/npx scripts, use `npm.cmd` and `npx.cmd` instead. If tunnel startup requests `@expo/ngrok`, follow the CLI prompt to install its tunnel helper. Keep Metro running and the computer awake. If the tunnel fails, resolve that error before testing group sharing; a QR code alone does not prove connectivity.

Install the SDK 58-compatible Expo Go using https://expo.dev/go on each phone. That page currently lists SDK 58 as latest, but the actual installed phone versions cannot be inspected from this computer. Check the Expo Go version/about information and confirm it opens this SDK 58 project without a compatibility error; follow the installer's current iOS instructions if an App Store version does not match.

Ario signs in to Expo Go with his own Expo account, matching `expo whoami` on his computer. Cyrus uses `cyrusclaude` on his iPhone and computer. Restart Metro after changing accounts. Each person scans their own computer's tunnel QR (Camera on iPhone; Expo Go on Android). Explicit `--go` prevents the installed expo-dev-client dependency from selecting development-build mode. Terminal output should target Expo Go, rather than an `expo-development-client` link.

The two homes do not need the same Wi-Fi, tunnel address or Expo account. Both JavaScript copies use the same hosted Supabase project URL/client key, so they should exchange membership and positions through that backend. Confirm this operationally by joining the same invite code; configuration inspection alone is not a two-phone pass. Each phone needs internet access to its tunnel and Supabase. Live Share is optional and does not replace cloning/configuring the second server.

## Short acceptance checklist

Keep both apps foregrounded and screens awake; start with a walking test outdoors and precise location allowed.

1. **Join:** Cyrus opens Ride together, enters his name, consents and creates a group. Send only the eight-character group code to Ario. Ario enters his own name, consents and joins. Both see two named members and the same group code. Try an incorrect code once.
2. **Location:** Walk independently. Both see positions and advancing location timestamps; tap remote markers. Expect roughly 5–15 seconds under good conditions, not a delivery guarantee. Remote riders may be far outside the current map viewport; pan/zoom to their actual location. No location should be fabricated while awaiting GPS.
3. **Record while sharing:** Both start a local ride and walk. Switch tabs and return; time/distance/route continue. Finish on one phone, inspect its saved ride, and confirm group sharing continues. Rides and Garage remain local, not synchronized to the other phone.
4. **Reconnect:** Disable network on Ario's phone for about 20 seconds. Cyrus should see an aging Last known position; Ario should show connection loss. Restore network and wait for retry/fresh GPS. Repeat with an outage over 90 seconds: expect membership expiry and explicit rejoin with the still-valid code. Groups have a 12-hour maximum lifetime.
5. **Leave:** With a local recording active, Leave on Ario's phone. Sharing stops locally, his marker disappears on Cyrus's next successful poll, and local recording continues. Finish it separately. Rejoin, disconnect, then Leave offline; restore network and verify pending removal retries. Previously sent locations can remain visible until the 90-second lease plus the next peer poll.
6. **Foreground boundary:** Briefly lock/background a phone and return. Treat Last known, route gaps and reconnection as foreground behavior; do not count screen-lock travel as a background pass. Recheck permission recovery if location is denied.

Record each outcome with both phone models/OS versions, Expo Go versions, matching Git commit, time, action and observed status/timestamp. Capture errors without env keys. Remote create/join, marker movement, simultaneous recording, reconnect and Leave remain pending until both people complete these steps.

## Checks and separate background work

Today: Expo Doctor passed 20/20; typecheck passed; lint has zero errors and one existing `useRecorder.ts` hook dependency warning; all 30 Node/PGlite tests passed. These local SQL tests mock Auth claims and do not verify hosted sign-in, native GPS or two-device networking. No phone installation, native visual review, tunnel launch or two-phone test was performed for this handoff. The reported Android development binary was not verified; an Android APK cannot run on an iPhone.

Background recording/sharing needs a separate iOS development build and physical-device validation; see BACKGROUND-BUILD.md. Keep the existing EAS linkage. Background OS scheduling and the 90-second membership lease still require device tests even after installing that build.

Sources checked: [Expo Go installer](https://expo.dev/go), [iOS account matching](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/), [Expo CLI/tunneling](https://docs.expo.dev/more/expo-cli/), [SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [Expo public environment variables](https://docs.expo.dev/guides/environment-variables/), [Supabase key types](https://supabase.com/docs/guides/getting-started/api-keys).
