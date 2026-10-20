# Security review, October 2026

An internal review of sign-in, access control, logging and secrets, done while adding the patient second step. It is not an independent test. The penetration test (`pentest-brief.md`) is still needed.

Scope: `server/` (sign-in routes, staff, shares, config) and the app's sign-in, storage and build settings. Not covered: infrastructure at Render and MongoDB Atlas, the website repos, the Clerk and Google Cloud configuration.

## Found and fixed in this change

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Critical | `POST /auth/social/verify` issued a 30-day patient token for any Google or Apple account when given its email address. The email came from the request body and nothing proved it. Anyone who knew a user's email could sign in as them. | The app now sends the Clerk session token. The server checks its signature against Clerk's keys and reads the verified primary email from Clerk (`server/clerkVerify.ts`). The email in the body is ignored. If `CLERK_SECRET_KEY` is missing the route refuses. |
| 2 | High | `POST /auth/2fa/toggle` accepted an email or phone number in the body with no token, so anyone could change another account's two-factor flag. | Requires a signed-in caller and changes only that caller's account. |
| 3 | High | `POST /auth/login` had no rate limit. Passwords could be guessed at the speed of the server. | 8 attempts per 15 minutes for one identifier from one address, 40 per address. |
| 4 | High | Patients had no real second sign-in step. The "Two-factor authentication" switch set a flag that nothing read. | Authenticator-app codes (TOTP) with 8 single-use recovery codes, enforced on password, SMS code, email code and Google or Apple sign-in. Five wrong codes lock it for 15 minutes. Used codes cannot be replayed. Secrets are sealed with AES-256-GCM and recovery codes are stored as HMAC hashes. |
| 5 | Medium | No log of who accessed an adult's record. | `AccountAuditLog` records sign-ins, second-step changes, password resets, sign-out of other devices, provider links created, opened, locked and withdrawn, consent shares and emergency card scans. The app shows it under Privacy and security > Security and access log. Kept two years. The owner's own reads are not logged. |
| 6 | Medium | 24 routes returned the raw exception object in 500 responses, which can expose internals. | The error is logged on the server. The client gets a plain message. |
| 7 | Medium | Android auto-backup was on by default, so app data could be copied to the person's Google account backup. | `allowBackup` is off in `app.json`. |
| 8 | Low | No check for weak or reused secrets. | Startup report (`server/secretsCheck.ts`), generator script, policy and runbook (`secrets-policy.md`), and a gitleaks scan on every pull request. |
| 9 | Low | No warning on rooted or jailbroken phones. | The app warns once per launch and in Privacy and security. It does not lock the app. |

## Added but off until you turn it on

- Certificate pinning for Android (`plugins/withApiPinning.js`). It does nothing unless `API_PINS` is set at build time. I could not read your live certificate from here, and a wrong pin would stop every request, so pins must come from `scripts/print-spki-pins.sh` run on your machine. It needs two pins, pins a CA key not the leaf, and expires on a date you choose so a forgotten pin cannot lock people out for ever. Test a preview build before production. Note the cost: a CA change at Render without a matching backup pin breaks old app versions until they update.
- `ENFORCE_SECRET_CHECKS=true` makes the server refuse to start on an error-level finding. Off by default so a stricter rule cannot take the API down on deploy.
- `MFA_SECRET_KEY` separates the key that seals patient authenticator secrets from `JWT_SECRET`. Set it before anyone turns the step on.

## Found and not fixed

| # | Severity | Finding | Why it is open, and what to do |
|---|---|---|---|
| A | Medium | Patient tokens last 30 days and cannot be revoked one by one. | Needs short access tokens with refresh tokens and a device list. A real change to the API and the app. Plan it next. |
| B | Medium | Sign-in codes (`otpCache`) are in server memory. A restart drops them. A second instance would not see them. | Fine on one Render instance. Move to the database with a TTL index before scaling out. |
| C | Medium | No server-side check that a Clerk session is still active after sign-in (the app token is separate once issued). | Acceptable: Clerk is used once to prove identity. Revisit with A. |
| D | Low | CORS accepts any `*.onrender.com` origin with credentials. | The API uses bearer tokens, not cookies, so a hostile page cannot ride a session. Remove the wildcard when the web prototype has its own domain. |
| E | Low | The store-reviewer bypass (`REVIEWER_OTP`) signs in the two reviewer accounts with a fixed code. | Needed during store review. Remove the variable afterwards. The startup report warns while it is on. |
| F | Low | Android screenshots and the recent-apps thumbnail show health data. | Needs `expo-screen-capture` (a native module, new build). It blocks screenshots people use for QR codes. Decide, then I can add it behind a setting. |
| G | Info | Rooted-phone detection is the OS's own flag (`expo-device`), which is easy to hide. | It is a warning, by design. |
| H | Info | Nothing has been tested against the live Google, Gemini, Clerk or Termii APIs from this repository. | The Clerk token check in particular has unit tests with a real RSA key pair but has not met Clerk's live keys. Test Google sign-in on a preview build before you ship. |

## Things to check on your side

1. Clerk dashboard: set `CLERK_SECRET_KEY` in Render, or Google and Apple sign-in will say "not available" after this deploys.
2. Old app builds (before this change) send no Clerk token, so Google and Apple sign-in fails on them. Internal testers must update.
3. MongoDB Atlas: network access list not `0.0.0.0/0` if you can avoid it, backups on, a user with only the rights the API needs.
4. Render: one instance means one failure takes the API down. Turn on health-check alerts.
5. Google Cloud: restrict the Places key by API and the Maps key by package name and SHA-1.
6. Play Console: the Data safety form must list location, the Assistant's use of Google Gemini, and account activity logging.
