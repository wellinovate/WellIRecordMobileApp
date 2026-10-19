# Play Console checklist and Data Safety draft

Package: `com.wellirecord.app`. Draft answers from what the code does on 2026-10-17. Check each against the final build and your privacy policy before submitting. You are the one who attests to Google.

## Do these in the Play Console

1. App access: give the reviewer a working login (an account with sample data and no MFA prompt). Put the steps in "App access".
2. Privacy policy URL: the policy page you host at wellirecord.com/privacy. It must match the answers below.
3. Account deletion URL: `https://<render host>/account-deletion` (served by this backend). Also enter it under Data safety > Data deletion.
4. Data safety form: use the table below.
5. Content rating questionnaire, target audience (adults; the app holds children's records but is used by guardians), ads declaration (no ads).
6. Health apps declaration: the app handles health information. Select it and describe the use as personal health records.
7. Store listing: icon 512x512, feature graphic 1024x500, at least 2 phone screenshots, short and full description. Describe only what ships. Do not claim diagnosis, treatment or a medical device.
8. Restrict the Maps API key to the package name and SHA-1 of the Play signing key.
9. D-U-N-S: needed for an organisation account.
10. Upload the AAB (`eas build -p android --profile production`) to internal testing first. Closed testing requirements depend on the account type and date, so check the current rule in the Console.

## Data Safety draft

Encrypted in transit: yes (HTTPS). Deletion request offered: yes (in app and by URL). Data sold: no. Shared with third parties for their own use: no (service providers below process data for us).

| Data type | Collected | Why | Optional |
|---|---|---|---|
| Name, email, phone number | Yes | Account, sign-in, reminders | Phone is optional |
| Date of birth, sex | Yes | Health record, growth charts, vaccine schedule | Required for children's charts |
| Health info (records, vitals, medications, prescriptions, vaccines, growth, development) | Yes | Core function | Yes |
| Photos and files (documents the user uploads) | Yes | Stored in the user's vault | Yes |
| Approximate or precise location | Yes, on request | Find nearby facilities. Used when the user taps it, not stored by us | Yes |
| Audio and video | Not stored | Video visits are live through LiveKit | Yes |
| Crash logs and diagnostics | Yes | First-party error reports with no name, email, phone or health data, deleted after 30 days | No |
| Device or other IDs | Push token | Notifications | Yes |

Service providers that process data for us: Clerk (sign-in), the hosting and database providers, Termii (SMS, only if the guardian turns it on), LiveKit (video visits), Expo (push notifications), and Anthropic (the Assistant: only the text the user types in the chat, with no records or account data). Scanned document images go to Google Cloud Vision and Anthropic for text reading (see the open decision in CLAUDE.md rules). Declare in Data safety: user-typed chat messages are shared with a service provider to give the answer.

## Known gaps before you submit

- The in-app policy text now describes in-app deletion. Make sure wellirecord.com/privacy says the same.
- Confirm the exact permissions in the built manifest (location comes from the expo-location plugin).
- The Data Safety form is your declaration. Counsel should read it with the NDPA pack.
