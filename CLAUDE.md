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

Tests: `npm test` (root) and `cd server && npm test`. Before opening a PR, run the type-check, lint, tests and the
Android export above.

## Configuration and secrets

Nothing secret is committed. Values come from the build environment (EAS env/secrets locally
via `.env`, which is gitignored):

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: required. Release builds throw at launch without it;
  dev builds fall back to the Clerk development instance.
- `EXPO_PUBLIC_API_URL`: optional override of the backend URL in `src/services/config.ts`.
- `EXPO_PUBLIC_WELLIPAY_API_URL`: address of the wellipay-api service. Without it the WelliPay and HMO and coverage screens show "not available". It is read at build time, so set it in EAS and rebuild: `npx eas-cli env:create --name EXPO_PUBLIC_WELLIPAY_API_URL --value https://<wellipay-api host> --environment preview --visibility plaintext` (repeat for `production`). The service's health check is `/healthz`.
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
Auth screens live in `src/features/auth/`. See "Patient sign-in security" below for the second step and the Clerk token check.

**Inactivity sign-out.** After 20 minutes with no touch the app signs out (`actions.autoLogOut`, same clean-up as `logOut`, with a message). `src/utils/inactivityCore.ts` holds the clock (`INACTIVITY_MS`, `markActivity`); `src/hooks/useInactivityLogout.ts` checks it every 15 seconds and when the app returns to the foreground, so time in the background counts. Touches are reported by the root view and by `src/components/ActivityModal.tsx`. A React Native `Modal` draws in its own window, so **always import `Modal` from `components/ActivityModal`, not from `react-native`**, or touches inside it will not count as activity and the person can be signed out mid-task. It is held off during a video visit (`state.inCall`). Typing on the keyboard alone does not count; a touch does.

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

## Password reset

`POST /api/v1/auth/password/forgot` emails a 6-digit code (5 minutes) to any email found in `User` or `Account`. `POST /api/v1/auth/password/reset` writes one bcrypt hash to both records and signs out all other devices. `/auth/login` checks `User` first and falls back to `Account`. `trust proxy` is set so rate limits count per client IP.

## Child health profile

A child is a `FamilyMember` with relationship `Child`. `ChildProfileModal` (opened from the family list) has four tabs: overview with WelliID QR and emergency card, vaccines, growth, details.

- Routes (all require the guardian's token and ownership of the child): `GET/PATCH /api/v1/family/:id/child-profile`, `POST/DELETE /api/v1/family/:id/vaccinations[/:vid]`, `POST/DELETE /api/v1/family/:id/growth[/:gid]`. `GET /api/v1/immunization/schedule` is public.
- The immunization schedule is data in `server/data/immunizationSchedule.ts`, with a `version` and a `reviewStatus`. It stays `pending_clinical_review` until a clinician checks each row against the official NPHCDA schedule and sets `reviewedBy` and `reviewedOn`. Do not copy dose timing into the app. Statuses are computed in `src/utils/immunization.ts`.
- A guardian can only create `caregiver_reported` doses. A clinic confirms one with `POST /api/v1/family/:id/vaccinations/:vid/verify` (header `x-admin-secret`, body `verifiedBy`, optional `source`). Guardians cannot delete verified doses.
- The QR code holds the WelliID only.
- Growth charts: `GrowthChart` (Growth tab) plots weight, length/height and head size against the WHO Child Growth Standards, 0 to 60 months. Tables are in `src/data/whoGrowth.ts`, generated by `scripts/build-who-data.py` from the WHO LMS tables; `WHO_GROWTH_REVIEW` stays `pending_clinical_review` until a clinician checks the tables and the wording. Maths is in `src/utils/growth.ts` (LMS z-score, WHO +-3 SD adjustment for weight, percentile, bands at +-2 and +-3). Wording says 'usual range' and 'ask your clinic', never a diagnosis. Children born before 37 weeks are read at corrected age until 24 months (parent can switch it off; readings before the due date are left off). Needs sex (Female or Male) and a valid date of birth.

## Guardians and access

The primary guardian is `FamilyMember.accountId`. Other adults are `ChildGuardian` rows. All checks go through `server/childAccess.ts`: `resolveChildAccess` and `effectivePerms`. A custody restriction (`blocked` or `view_only`) always overrides a guardian's grants.

- Permissions: `viewRecords`, `addRecords`, `bookAppointments`, `receiveReminders`, `manageGuardians`. Enforced on the child routes, on records and prescription reads (opt-in third argument of `callerCanAccessOwner`) and on appointment booking. Other write routes stay primary-only.
- Invite: `POST /family/:id/guardians` returns a one-time 8 character code (hashed at rest, 7 days). The invited adult enters it with `POST /family/guardians/accept`.
- Transfer: `POST /family/:id/transfer` emails a code to the target's own account email. The target accepts with `POST /family/:id/transfer/accept`. The previous primary stays on as a guardian without `manageGuardians`.
- Custody lock (staff, header `x-admin-secret`): `POST /family/:id/custody` with `action` lock or unlock. While locked, guardian changes and transfers return 423. `POST /family/:id/guardians/:gid/verify-identity` records a staff identity check.
- Access log: `ChildAuditLog`, written by `auditChild`. `GET /family/:id/audit` is limited to the primary guardian and guardians who manage guardians. Views are deduplicated per 30 minutes.
- The app cannot verify a court order. Restrictions record the reason and reference for staff review.

## Development, school and the move to adulthood

- Milestones: catalogue in `server/data/milestones.ts` (CDC Learn the Signs. Act Early, 2 months to 5 years), versioned, `pending_clinical_review` until a Nigerian paediatrician signs it off. Guardians answer yes, not yet or not sure per milestone. A "not yet" for an age the child has reached only produces a prompt to talk to a clinician. The app never gives a result or diagnosis. Routes live in `server/childDevelopment.ts`; screening visits (developmental, vision, hearing, dental) are logged there too.
- School profile: stored on `childProfile.school`. Nothing is sent to a school. The guardian ticks what to include and shares or prints a summary through the system share sheet or print dialog (`SchoolProfileCard`). Each share is written to the access log.
- Moving to their own account: `Self` is a guardian relationship for the child's own account. It can be invited from 13 (`TEEN_ACCESS_AGE`) with view access and without `manageGuardians`. Transfer to a `Self` guardian is refused before 18 (`MAJORITY_AGE`). Both ages and the age check are in `server/childAccess.ts`.

## Reminders and offline capture

- Reminders: `server/childReminders.ts`. An hourly sweep (first run 2 minutes after start) works out which scheduled doses are due soon, due or overdue for each child and sends one message per guardian, channel and period. `ReminderLog` has a unique key so a reminder is never sent twice, and expires after a year. Messages go out 8am to 8pm Lagos time and contain the child's name and a dose count, not vaccine names. Only guardians with `receiveReminders` and no `blocked` restriction are messaged.
- Channels per guardian (`ReminderPreference`, `GET/PUT /family/:id/reminders`): app notification (default on), SMS and WhatsApp. SMS and WhatsApp need a valid Nigerian mobile number and are off until the guardian turns them on, which records a consent time. SMS needs `TERMII_API_KEY`. WhatsApp also needs `WHATSAPP_REMINDERS_ENABLED=true` (optional `TERMII_WHATSAPP_SENDER`). The WhatsApp path has not been tested against Termii, and the sender and template need Termii/Meta approval first. The app disables the switches when the server reports a channel unavailable.
- Offline capture: `src/utils/childOfflineQueue.ts`. A vaccine dose or growth measurement that fails with a network error is stored on the phone and shown as "Waiting to sync". It is sent at sign-in, when the app returns to the foreground, or from "Sync now". Growth entries carry a `clientId` so a retry never duplicates; a 409 on a dose means it is already saved. An entry the server refuses (4xx) stays in the list with the reason until the guardian discards it. The last loaded profile is cached per child for reading offline. Milestones and the access log need a connection. Queue and cache are cleared on sign out and account deletion.

## Staff accounts

Staff routes (provider and operations side) use per-person accounts in `server/staff.ts`, not a shared secret.

- Roles: `admin`, `clinician`, `pharmacist`, `records_officer`. Admin passes every check. Vaccination confirm: clinician or records officer. Visit summary: clinician. Pharmacy orders: pharmacist. Custody lock and guardian identity check: records officer.
- First admin: `POST /api/v1/staff/bootstrap` with the `x-admin-secret` header and `{email, name, password}`. It works once, only while no admin exists. After that, an admin signs in with `POST /staff/auth/login` and adds people with `POST /staff/users`. The response holds a one-time temporary password; the person must change it (`POST /staff/auth/change-password`) before anything else.
- Staff tokens last 8 hours and are signed with a key derived from `JWT_SECRET` but different from patient tokens. Changing a role, disabling an account or changing a password ends open sessions. Five wrong passwords lock the account for 15 minutes.
- Every non-GET staff call is written to `StaffActionLog`. Recorded names (`verifiedBy`, `setBy`, `authoredBy`) are the signed-in person's own name; typed names are only taken for the legacy secret.
- Legacy: `x-admin-secret` is off by default. Set `ALLOW_LEGACY_ADMIN_SECRET=true` to turn it back on for a caller that has not moved to staff tokens (each use is logged and warned). `/staff/bootstrap` still takes the secret, once. Neither console repo (`wellinovate/wellirecords`, `wellinovate/WelliRecord`) calls these endpoints.
- MFA: after the password, staff enter a TOTP code (RFC 6238, `server/totp.ts`). Secrets are sealed with a key derived from `JWT_SECRET`; 8 single-use recovery codes. Staff without MFA can only reach `/staff/mfa/*`, `/staff/me` and change-password until they enrol. `STAFF_MFA_REQUIRED=false` turns the requirement off. Lost phone: an admin calls `POST /staff/users/:id/reset-mfa`, or `npx ts-node scripts/reset-staff-mfa.ts <email>`.
- Web pages (`server/consolePages.ts`): `/clinic` (sign in, forced password change, MFA setup, for admins: add staff, change role, disable, reset password or MFA, action log; open a child's record with WelliID and parent code, record vaccines and measurements) and `/admin/orders` (pharmacist order review). Both use staff tokens held in page memory, a per-request CSP nonce and no inline handlers.
- Server tests: `cd server && npm test`.

## FHIR export and clinic access

- Export: `GET /api/v1/family/:id/fhir` returns a FHIR R4 `collection` Bundle (Patient, AllergyIntolerance, Immunization, Observation for weight, height and head circumference with LOINC codes). Needs `viewRecords`; each export is written to the access log. Built in `server/fhir.ts`. Each dose carries our schedule code plus a CVX code where `server/data/vaccineCodes.ts` has one (pending clinical review, sheet in `docs/review/vaccine-codes-review.md`). SNOMED is not mapped. Parent-reported doses have `primarySource: false` and a `caregiver_reported` tag; clinic-confirmed doses have `primarySource: true`. The app's "Export full record (FHIR)" button sends the JSON to the share sheet.
- Clinic access (`server/childFacility.ts`): a guardian with `manageGuardians` creates an 8 character code for 1 to 72 hours (default 24) in the Access tab. The code is stored as an HMAC and shown once. A clinician or records officer signs in with a staff account and sends the child's WelliID and the code to `POST /facility/child/lookup` (record as a FHIR Bundle), `/facility/child/vaccinations` (adds a `provider_verified` dose or confirms the parent's entry) or `/facility/child/growth` (source `clinic`). Wrong code, unknown WelliID, expired and cancelled codes all return the same 403. A custody lock returns 423. Every use is recorded on the grant and in the child's access log under the staff member's name, and the primary guardian gets a notification for writes.
- Clinic screen: `/clinic` on this server. Not built: SNOMED mapping, FHIR import into the app, export of an adult's own record.

## WelliBridge provider sharing

A patient or guardian shares part of a record with a provider who has no WelliRecord account. Code: `server/providerShare.ts`, page `server/providerSharePage.ts`, model `ProviderShare`, app `ProviderShareModal` (Profile > Share with a provider).

- Encryption (`src/utils/sealedShare.ts`, `SEAL_JS` in `server/providerSharePage.ts`): the phone fetches a snapshot of the chosen sections (`POST /provider-shares/snapshot`), encrypts it with a random AES-256-GCM key (`@noble/ciphers`, random bytes from `expo-crypto`, AAD `wellibridge:v1`) and uploads only ciphertext and the nonce. The link is `<base>/share/<token>#k=<key>`; the QR encodes the same link. The part after `#` is never sent in a request, and the page reads it, removes it from the address bar and decrypts with WebCrypto after the code is entered. `GET /provider-share/:token/record` returns ciphertext only. The server cannot decrypt a shared copy. Tests prove the phone's output opens with the page's own code (`tests/sealedShare.test.ts`).
- What this does not protect: the server read the data to build the snapshot, and it serves the page that decrypts, so a compromised server could serve altered page code. The key is in the link, so anyone holding the full link or QR plus the one-time code can read it until it expires or is withdrawn. The shared copy is a snapshot taken when the link is created. Do not call it zero-knowledge; call it an encrypted link whose key we do not receive.
- Ciphertext is deleted on withdrawal, lock, and by an hourly sweep after expiry (`sweepSealed`); the link row stays 30 days for the access history. Creating a link without ciphertext is refused (`encryption_required`) unless `ALLOW_LIVE_PROVIDER_SHARE=true`, which only exists for old app builds. Old live links still open the old way until they expire.
- Where it is offered: Profile > Share with a provider; a record's detail sheet ("Share by encrypted link or QR", shares only that record as text via `recordIds` on `POST /provider-shares/snapshot`, limited to the subject's own records, max 20); and a card at the top of Smart Consent Controls ("Provider not on WelliRecord?"). The app opens the modal with `actions.openProviderShare(draft)`.
- Patient routes (token): `POST/GET /provider-shares`, `POST /provider-shares/snapshot`, `POST /provider-shares/:id/revoke`. Children need `manageGuardians`; a custody lock returns 423. Sharing needs at least one section from allergies (also blood group, genotype), conditions, medications, records, vaccinations, growth (children only). Name, date of birth, sex and WelliID are always included. Files and scans are never included. Ciphertext limit about 300 KB.
- Link: `<base>/share/<token>`, 1 hour to 7 days (default 24). Token stored as an HMAC. The page sets `Referrer-Policy: no-referrer`, a nonce CSP and `noindex`.
- Provider routes (public, rate limited): `/provider-share/:token/info`, `/otp`, `/verify`, `/record`. A 6-digit code is needed to open it: sent by email or SMS to the contact the patient entered (valid 10 minutes, 5 sends an hour), or a passcode shown once to the patient. 5 wrong codes start a 15 minute cooldown; 15 lifetime wrong codes lock the link and notify the patient. A correct code gives a 15 minute view session that is checked against the link status on each read, so withdrawing the link ends it at once.
- Each successful open is logged on the link (time, IP, user agent) and the patient gets a notification.
- SMS needs `TERMII_API_KEY`; email needs the Resend settings. Not built: attachments, export as FHIR, staff-side view of these links. Integration test: `server/tests/integration/providerShare.test.ts` (CI only).

## Live Assistant

Tab: Assistant (`src/screens/ChatScreen.tsx`). Typed questions go to `POST /api/v1/assistant/message` (`server/assistant.ts`), which calls Google Gemini (`streamGenerateContent`, or the Anthropic Messages API if only `ANTHROPIC_API_KEY` is set) with the WelliRecord knowledge base in `server/data/assistantKnowledge.ts` and streams the answer as server-sent events (`notice`, `delta`, `error`, `done`). The app reads the stream with `expo/fetch` (`chatbotService.ask`, parser in `src/utils/sse.ts`). The old menu buttons (`/chatbot/open`, `/chatbot/respond`) stay as quick starts.

- Needs `GEMINI_API_KEY` on Render (Google AI Studio key; model from `GEMINI_MODEL`, default `gemini-2.5-flash-lite`; check the id against Google's current model list). `ANTHROPIC_API_KEY` with `ASSISTANT_MODEL` (default `claude-haiku-5-5`) is the fallback when no Gemini key is set. Free-tier Gemini keys have low rate limits and Google may use free-tier content to improve its products, so use a billing-enabled key for real users. Neither provider path has been run against the live API from this repo. Without the key the route returns 503 and the app tells the user to use the quick questions. `GET /assistant/status` reports whether it is live.
- It has no tools and no access to the user's records or account. It is told the list of approved WelliRecord providers (public directory data) so it can name them. Only the typed conversation (last 20 turns, 2000 characters each) is sent. Nothing is stored on our side.
- Signed-in only. 30 questions an hour per person.
- Emergency words in the last message (breathing, chest pain, seizure, bleeding, stroke, overdose, self-harm) make the server send a fixed notice to call 112 before the answer. The prompt forbids diagnosis, doses and starting or stopping medicines.
- When a feature ships or changes, update the knowledge base file. It must say only what the app does. Vaccine timing is deliberately not in it.
- Tests: `server/tests/assistant.test.ts` (fake model, no database), `tests/sse.test.ts`.

## Nearby labs and pharmacies

`LabDirectoryModal` and `PharmacyDirectoryModal` ask for foreground location (`src/utils/nearby.ts`, `src/hooks/useNearbyDirectory.ts`) and call `GET /care/labs` or `/care/pharmacies` with `lat` and `lng`. The server (`server/nearbyPlaces.ts`) runs Google Places API (New) (`places:searchNearby` for pharmacy and hospital, `places:searchText` with a location bias for lab, clinic and maternity) around that point, widening 8, 25, 50 km until something is found, sorts by distance and caches per 1 km cell for 6 hours. 60 searches an hour per IP. Needs `GOOGLE_PLACES_API_KEY` with **Places API (New)** enabled and billing on. The legacy Places API is not offered to new Google Cloud projects, so it returns REQUEST_DENIED there. The old Abuja district search (no `lat`/`lng`) still calls the legacy text search and falls back to the saved list. Without the key, or if Google fails, the saved Abuja list is returned only when the person is within 60 km of Abuja; elsewhere the list is empty. Without `lat` and `lng` the old Abuja district search still runs. Coordinates are not stored. Registered providers come first: `server/welliProviders.ts` reads approved `OrganizationProfile` rows (cached 5 minutes, `healthcare_provider` shows under hospitals and clinics, and under maternity only if the name says so; `diagnostic` is labs; `pharmacy` is pharmacies; those with no `location` coordinates or more than 100 km away are left out), puts them before the Google results with `welliRecord: true` and `facilityId`, drops a Google copy of the same place, and still returns them when Google fails. The app shows a WelliRecord mark and books them as WelliRecord facilities, so the facility is notified. Other results are unverified Google listings, not partner facilities.

The Assistant is given the approved providers (name, type, address, capped at 50, cleaned, labelled as data) in its instructions on each question (`providerContext`, `extraContext` in `server/assistant.ts`). It still reads no one's records.

`CareLocatorModal` (Care tab > Hospitals, clinics and maternity) uses the same path through `GET /care/places?kind=hospital|clinic|maternity&lat&lng` (Places type hospital, type doctor with keyword clinic, keyword maternity hospital). It needs a position and has no saved list: nothing is invented when Google is unavailable.

Booking at a Google listing (`externalBookingFacility`) saves an `AppointmentRequest` with `externalFacility: true` and an optional `providerRemark` (built in `src/utils/providerRemark.ts`: says the patient uses WelliRecord, gives the WelliID, points to a WelliBridge link and wellirecord.com). The facility is not notified by us; after saving, the app opens the share sheet with the request so the person sends it. The remark can be switched off per booking.

## Appointment notifications

`POST /appointments/requests` now notifies after saving (`server/appointmentNotify.ts`): the patient gets an in-app notification, an email (if the account has one and an email provider is set) and an SMS (Nigerian mobile and `TERMII_API_KEY`). The facility gets an email and an SMS only if it is a WelliRecord organisation (`OrganizationProfile` found by `facilityId`) with `email`, `officeEmail`, `contactEmail`, `adminEmail` or `phone` on file; the mobile `Facility` directory and Google listings have no contact, so nobody is messaged and the app says so. Messages carry patient name, date, time, visit type and a 6 character reference, never the reason. A channel counts as delivered only when the sender reports it (`sendWelliEmail` returns `delivered`); what was delivered is stored on the request as `notified` and summarised in the `notice` field the app shows. When a facility confirms or cancels (found by the one-minute sweep, because the web console changes the status), the patient gets push, email and SMS. Not built: retry of a failed email or SMS, facility notification for non-WelliRecord facilities.

## Consultation booking

Care tab > Book a consultation (`ConsultBookingModal`, `src/services/bookingService.ts`). Five steps: visit type (in person or virtual), date, provider and time, payment method, review and confirm. Server: `server/booking.ts` (routes), `server/bookingCore.ts` (rules, no database), models `ProviderService` and `BookingSlot`; extra fields on `AppointmentRequest` (`startsAt`, `bookingRef`, `feeMinor`, `paymentMethod`, `paymentStatus`, `hmo`).

- Providers publish fees (one per mode), weekly hours (Lagos time), slot length, HMOs accepted, and whether pay at visit and online payment are allowed. An admin sets them at `/admin/consultations` (`PUT /staff/providers/:facilityId/service`). `facilityId` is the app's facility id or the registered organisation id. A facility with no profile keeps the old request flow; `openBookAppointment` checks `GET /booking/offers/:facilityId`.
- The fee always comes from the provider record for the chosen mode. The app never sends a price.
- Slot hold: `POST /booking/holds` takes the time for 10 minutes (15 once an online payment starts). The unique index on `BookingSlot` (`facilityId`, `startsAt`) stops double booking; expired holds are ignored by every query and removed by a TTL index. A hold belongs to one account.
- Confirm (`POST /booking/confirm`): pay in person -> `confirmed`, payment status `pay_at_visit` (only if the provider allows it). Online -> `awaiting_payment`; confirmed only when Paystack says it succeeded (webhook `POST /booking/paystack/webhook`, signature checked on the raw body, amount re-checked with Paystack, plus `GET /booking/:id` and a one-minute sweep as fallbacks). HMO -> `awaiting_hmo`; the app's pre-authorisation result is stored but never trusted, staff approve or decline at `/admin/consultations` (`POST /staff/bookings/:id/hmo`). Decline cancels and frees the time. An unpaid online booking is cancelled after about 17 minutes. Money that arrives for a cancelled or lost slot sets `paymentStatus: refund_due` for a person to refund; nothing is refunded automatically.
- Virtual visits: `POST /telehealth/appointments/:id/token` uses the join window (10 minutes before the start until an hour after the end) when `startsAt` is set; older requests keep the day-of rule.
- Needs `PAYSTACK_SECRET_KEY` on Render for online payment (webhook URL `<api>/api/v1/booking/paystack/webhook` in the Paystack dashboard). Without it the online option is off. WelliPay has no call to create a bill for a booking, so online payment does not go through it. HMO plans and pre-authorisation come from WelliPay on the phone.
- The terms text is `BOOKING_TERMS` in `server/booking.ts` (`draft-1`); it has not had a legal review. The web console in the other repos reads `appointmentrequests` and does not know the new statuses `awaiting_payment` and `awaiting_hmo`.
- Tests: `server/tests/bookingCore.test.ts`, `server/tests/integration/booking.test.ts` (CI only).

## Pharmacy orders

Care tab > Order medication (`PharmacyOrdersModal`, `src/services/pharmacyOrderService.ts`; also "Order here" in the pharmacy directory for WelliRecord pharmacies, and the `pharmacyOrders` notification target). Server: `server/pharmacyOrders.ts` (routes), `server/pharmacyCore.ts` (rules, no database), models `PharmacyService`, `PharmacyOrder`, `PharmacyAttachment`. Do not confuse with the older `Prescription`-based orders (`/pharmacy/orders`, `OrderMedicationModal`, `/admin/orders`), which still exist.

- Flow: `awaiting_review` -> pharmacist quote -> `quoted` -> checkout -> `awaiting_payment` (online) | `awaiting_hmo` | `confirmed` -> `dispatched` | `ready_for_pickup` -> `delivered` | `collected`. Ends: `cancelled`, `rejected`, `expired` (quote lasts 24 hours). The address is collected at checkout, after the quote, because the fee depends on it. `POST /pharmacy-orders/:id/preview` shows the total and the payment options without saving anything. Nothing is dispatched until the payment rule for the chosen method is met.
- Each pharmacy sets its own delivery fee: distance bands (`feeBands`: up to km, fee in kobo) from the pharmacy's latitude and longitude (haversine) to the address the phone sends. Beyond the last band the pharmacy does not deliver (409 `out_of_range`). With no coordinates from the phone the highest band applies and the app labels it an estimate. WelliRecord does not dispatch: the pharmacy assigns its own rider (name, phone, note) at `/admin/pharmacy`. No live tracking, no logistics partner integration, no delivery-time estimate beyond the pharmacy's `deliveryEta` text.
- Pharmacy setup and the order queue are at `/admin/pharmacy` (staff sign-in with MFA). Admin saves a pharmacy (`PUT /staff/pharmacy/services/:facilityId`) and assigns `staffIds`; a `pharmacist` sees only the orders of pharmacies they are assigned to, admin sees all. Staff routes: `/staff/pharmacy/orders[/:id]`, `.../quote|reject|hmo|dispatch|ready|deliver|collect|cancel`, `.../files/:fileId`.
- Payment: online uses Paystack with references `wo-<orderId>-<6 hex>` (a new one for each attempt); the webhook is the booking webhook (`/booking/paystack/webhook`), which hands non-`wr-` references to `pharmacyOrders.verifyAndSettle` (amount and currency re-checked with Paystack; underpaid or late money sets `paymentStatus: refund_due`). Status check on `GET /pharmacy-orders/:id` and a one-minute sweep are fallbacks. A payment not finished after 30 minutes sends the order back to `quoted`. HMO is never trusted from the phone: staff approve with the covered amount (`POST .../hmo`), the balance goes to online payment or to delivery/pickup. Cancelling a paid order flags `refund_due`; nothing is refunded automatically.
- Prescription files: JPEG, PNG or PDF up to 2.5 MB, type checked from the first bytes, stored sealed (AES-256-GCM, `PHARMACY_SEAL_KEY`, falls back to `JWT_SECRET`; do not change it after launch or stored files and codes become unreadable) in our own database, never sent to a third party. Needs the patient's consent to share; linking the medication to their record is a second, optional consent (on delivery the dispensed lines are added as `Prescription` rows with `orderType: record_from_order`). Staff opening a file is written to the patient's account log (`prescription_viewed`); sending is `prescription_shared`. Files expire 30 days after the order ends; an upload never attached to an order expires after a day.
- Handover: a six digit code created at checkout, sealed at rest, shown to the patient only. The rider or counter staff enters it at `deliver` or `collect`; five wrong codes lock that step for 15 minutes. Cash orders become `paid_on_handover` then.
- Limits: 5 open orders per person; up to 20 medicines per order; 3 files per order.
- Terms text is `PHARMACY_TERMS` (`draft-1`), not legally reviewed.
- Not built: ordering for a family member, live dispatch or rider tracking, SMS or email for status changes (push only), refunds through Paystack, controlled-drug rules, pharmacy licence checks, the "Rescheduled" telemedicine status.
- Tests: `server/tests/pharmacyCore.test.ts`, `server/tests/integration/pharmacyOrders.test.ts` (CI only).

## Patient sign-in security

- Second step (`server/patientAuth.ts`, model `PatientMfa`): authenticator-app TOTP plus 8 single-use recovery codes, reusing `server/totp.ts`. A sign-in route that has passed its first factor (password, SMS or email code, Clerk) calls `patientAuth.gate()`. If the account has the step on, no token is issued: the route returns `{ mfaRequired, mfaToken }` and the app finishes with `POST /auth/mfa/verify`. The gate is on `/auth/login`, `/auth/otp/verify` and `/auth/social/verify`. A new sign-in route must call it too. Settings routes: `GET /auth/mfa/status`, `POST /auth/mfa/setup|enable|disable|recovery-codes`. Five wrong codes lock it for 15 minutes; a used step cannot be replayed. Secrets are sealed with `MFA_SECRET_KEY` (falls back to `JWT_SECRET`). Set `MFA_SECRET_KEY` before anyone turns it on and do not change it later: that locks every user out of their second step.
- In the app: `MfaChallengeModal` (code prompt, driven by `state.mfaPrompt` and `resolveMfa` in `useWelliApp`), `TwoStepModal` (set up, recovery codes, turn off), both opened from Profile > Privacy and security.
- Social sign-in: the app sends the Clerk session token; `server/clerkVerify.ts` checks its signature against Clerk's keys and takes the verified email from the Clerk API. Needs `CLERK_SECRET_KEY`, else the route returns 503. The email in the request body is never trusted.
- Account log (`server/accountAudit.ts`, model `AccountAuditLog`): `auditAccount(req, accountId, 'security'|'access', action, actorLabel, detail)`. Written for sign-ins, second-step changes, password reset, sessions revoked, provider links (created, opened, locked, withdrawn), consent shares and emergency scans. The owner's own reads are not logged. `GET /account/audit?kind=&before=&limit=`; the app shows it as `AccountLogModal`. IPs are masked to the last octet. Kept two years. Add an `ACTION_LABELS` entry when you add an action.
- Login is rate limited per address and per address plus identifier. 500 responses never return the exception; log it and send a plain message.
- Secrets: `server/secretsCheck.ts` reports weak settings at boot (names only). `ENFORCE_SECRET_CHECKS=true` makes errors fatal. Policy and rotation steps: `docs/security/secrets-policy.md`. CI runs gitleaks on new commits. Never paste a secret into chat.
- Device: `src/utils/deviceIntegrity.ts` warns on a rooted or jailbroken phone (a warning, not a lock). Android auto-backup is off.
- Certificate pinning is opt-in: `plugins/withApiPinning.js` does nothing unless `API_PINS` (two or more SPKI hashes from `scripts/print-spki-pins.sh`) is set in the build environment. Test a preview build first.
- Review and test brief: `docs/security/security-review.md`, `docs/security/pentest-brief.md`. Integration test: `server/tests/integration/patientMfa.test.ts` (CI only).

## Rules for changes

- Health documents must not be sent to third-party services. Open them in-app or hand the
  file to the user's own app (see `PdfViewerModal`).
- Account deletion must surface server errors and only sign the user out on success.
- Do not commit API keys, keystores or `.env` files.
- Use one lockfile: `package-lock.json`.
