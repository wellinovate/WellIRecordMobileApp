# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

WelliRecord mobile: an Expo (SDK 57) / React Native 0.86 app for patient-owned health
records. Native entry is `index.js` -> `src/App.expo.tsx`. A browser prototype of the same UI
still exists (`src/main.tsx` -> `src/App.tsx`, served by Vite) and is not what ships to the
stores. `server/` holds the Express + MongoDB backend deployed on Render.

## Commands

```bash
npm start                                  # Expo dev server
npm run android                            # build and run a dev client on Android
npm run dev                                # Vite browser prototype
npm run lint                               # oxlint (rules in .oxlintrc.json)
npx tsc --noEmit -p tsconfig.app.json      # type-check the app (must pass)
CI=1 npx expo export --platform android --output-dir /tmp/export   # verify Metro bundles
eas build -p android --profile preview     # internal APK
eas build -p android --profile production  # Play Store AAB
```

There is no test runner configured. Before opening a PR, run the type-check, lint and the
Android export above.

## Configuration and secrets

Nothing secret is committed. Values come from the build environment (EAS env/secrets locally
via `.env`, which is gitignored):

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: required. Release builds throw at launch without it;
  dev builds fall back to the Clerk development instance.
- `EXPO_PUBLIC_API_URL`: optional override of the backend URL in `src/services/config.ts`.
- `EXPO_PUBLIC_WELLIPAY_API_URL`: address of the wellipay-api service. Without it the WelliPay screen shows "not available".
- Server env for video visits (Render): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Without them the token route returns 503.
- `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY`: read by `app.config.js`.

`app.json` holds static Expo config; `app.config.js` layers the Maps keys on top.

## Architecture

**Single state hook.** `src/state/useWelliApp.ts` is the source of truth: one `AppState`
object updated through `patch()`, plus an `actions` object of every mutation. `App.expo.tsx`
calls it once and passes the result (typed `WelliApp`) to screens and modals as an `app` prop.

**Screens and modals read `app` directly.** `src/screens/` and `src/modals/` take
`{ app }: { app: WelliApp }` and derive their own view data. Modals are always mounted and
return `null` when their `state.show*` flag is false. Because of that, every hook in a modal
must be called before the early `return null`; calling a hook after it crashes when the modal
opens.

**Tabs are state, not routes.** `state.tab` selects the screen. There is no router.

**Services talk to the backend.** `src/services/` wraps the REST API through `apiClient.ts`
(Bearer token, timeout, normalized errors). Services call the live API only; there is no demo
or offline-fake mode. `offlineSyncService` queues mutations while offline.

**Auth.** Clerk (`@clerk/expo`) with tokens in `expo-secure-store` (`src/utils/tokenCache.ts`).
Auth screens live in `src/features/auth/`.

**Styling.** NativeWind `className` plus inline style objects. `nativewind-env.d.ts` is
included in `tsconfig.app.json` so `className` type-checks. Theme colors come from
`ThemeContext` (`LIGHT_THEME` / `DARK_THEME` in `src/data/mockData.ts`).

## Video visits

Patients join through LiveKit. `POST /api/v1/telehealth/appointments/:id/token` issues a
one-hour token for room `wr-visit-<appointmentId>` when the visit is a confirmed video visit
on the current Lagos day. The clinician side (web console) must join the same room name in the
same LiveKit project. The app needs a native build (LiveKit/WebRTC); Expo Go does not work.

After a visit, the clinician side posts the summary with the admin secret:
`POST /api/v1/telehealth/appointments/:id/summary` (header `x-admin-secret`, body `diagnosis`,
`notes`, `authoredBy`, optional `prescription {medicationName, dosage, frequency, refillsTotal}`).
It completes the visit, files a clinical note in the patient's vault, and notifies the patient.

## Sessions

`POST /api/v1/auth/sessions/revoke-others` signs out every other device (account
`sessionsRevokedAt`, checked in `getAuthUserId`) and returns a fresh token for the caller.

## Rules for changes

- Health documents must not be sent to third-party services. Open them in-app or hand the
  file to the user's own app (see `PdfViewerModal`).
- Account deletion must surface server errors and only sign the user out on success.
- Do not commit API keys, keystores or `.env` files.
- Use one lockfile: `package-lock.json`.
