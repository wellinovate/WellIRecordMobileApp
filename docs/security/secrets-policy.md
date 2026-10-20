# Secrets policy and rotation runbook

Applies to everything that grants access to WelliRecord systems or data: API keys, signing secrets, database passwords, staff passwords, the Play upload key and the EAS account.

## Rules

1. Secrets live in the host's secret store only: Render environment, EAS secrets, Clerk, Google Cloud. Never in the repo, a chat, a ticket, a screenshot or an email.
2. One secret per purpose. `JWT_SECRET`, `ADMIN_SECRET` and `MFA_SECRET_KEY` must be different values. The server warns if two match.
3. Generate secrets with `npx ts-node server/scripts/generate-secrets.ts`. Do not invent them.
4. A secret that appears anywhere outside the secret store is treated as leaked. Rotate it the same day.
5. Give each person their own staff account. The shared `ADMIN_SECRET` stays off (`ALLOW_LEGACY_ADMIN_SECRET` unset).
6. The store-reviewer bypass (`REVIEWER_OTP`) is set only while a store review is under way, then removed.
7. Rotate on a schedule even without a leak: signing and database secrets every 12 months, third-party API keys every 6 months, and whenever someone with access leaves.
8. CI scans every pull request's new commits with gitleaks. A finding blocks the merge. If it is real, rotate the secret first, then remove it from the branch.

## Inventory

| Secret | Where it is set | What breaks if it changes | Owner |
|---|---|---|---|
| `JWT_SECRET` | Render | Every patient is signed out. Staff MFA secrets stop opening (reset each staff member's MFA). | Founder |
| `MFA_SECRET_KEY` | Render | Every patient with the authenticator step loses it. Set once, before launch. Do not rotate casually. | Founder |
| `ADMIN_SECRET` | Render | Only the one-time `/staff/bootstrap` call. | Founder |
| `MONGODB_URI` | Render | API cannot reach data until updated. Change the Atlas user password, then the variable. | Founder |
| `CLERK_SECRET_KEY` | Render | Google and Apple sign-in are refused until updated. | Founder |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | EAS | Public by design. Not a secret. | Founder |
| `GEMINI_API_KEY` | Render | Assistant returns 503. | Founder |
| `GOOGLE_PLACES_API_KEY` | Render | Nearby search falls back to registered providers only. | Founder |
| `GOOGLE_MAPS_ANDROID_API_KEY` | EAS | Map tiles blank until rebuilt. Restrict by package name and SHA-1. | Founder |
| `TERMII_API_KEY` | Render | SMS codes stop. | Founder |
| `RESEND_API_KEY` | Render | Email codes stop. | Founder |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Render | Video visits return 503. | Founder |
| Staff passwords | Each person | That person only. | Each person |
| Play upload key, EAS account | EAS, Google | Cannot ship builds. Keep the recovery codes offline. | Founder |

## Rotation steps

For a service key (Gemini, Places, Termii, Resend, Clerk, LiveKit):

1. Create a new key in the service's dashboard. Restrict it (API, app, IP or referrer) where the service allows.
2. Put it in Render, save, let the service redeploy.
3. Test the feature once (a code SMS, one Assistant question, one nearby search).
4. Delete the old key in the dashboard. Do this last, so nothing is down in between.

For `JWT_SECRET`:

1. Run the generator and set the new value in Render. All patients are signed out on the next request.
2. Reset MFA for every staff account that has it: `npx ts-node server/scripts/reset-staff-mfa.ts <email>`. They enrol again at next sign-in.
3. Tell patients to sign in again if they ask. Nothing else needs doing.

For the database password: change it in Atlas, update `MONGODB_URI` in Render at once, confirm `/healthz` is green.

## After a leak

1. Rotate the secret (above) before anything else.
2. Check the provider's usage page for use you do not recognise (Google Cloud, Termii, Resend, Gemini billing).
3. Check `StaffActionLog` and the account audit log for unfamiliar actions in the exposure window.
4. If patient data could have been read, follow the breach procedure in `docs/compliance/ndpa-review-pack.md` (NDPC notice within 72 hours of becoming aware).
5. Write down what happened, what was rotated and when.

## Keys exposed during the build, to rotate now

These were pasted into chat while building. Treat them as leaked.

- `GEMINI_API_KEY` (pasted several times)
- `ADMIN_SECRET` and the first admin staff password
- Any `GOOGLE_PLACES_API_KEY` created before the current one
- Any Termii, Resend or Clerk key shown in a screenshot

## Startup check

The server reports weak or risky settings at boot (`server/secretsCheck.ts`): short or common `JWT_SECRET`, reused secrets, local database in production, test SMS key, the reviewer bypass, legacy admin secret, unencrypted provider links, staff MFA off, missing `MFA_SECRET_KEY` or `CLERK_SECRET_KEY`. It logs names only, never values. Set `ENFORCE_SECRET_CHECKS=true` to make an error-level finding stop the server from starting. Turn that on once the log is clean.
