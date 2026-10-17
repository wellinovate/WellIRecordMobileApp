# NDPA review pack for counsel

Status: draft prepared from the code on 2026-10-17. It is a working document for a Nigerian data protection lawyer or a licensed Data Protection Compliance Organisation (DPCO). It is not legal advice and nothing here has been filed with the Nigeria Data Protection Commission (NDPC).

Obligations marked (summary) come from a public summary of the NDP Act 2023 and the GAID 2025 ([LawPavilion](https://blog.lawpavilion.com/ndp-act-2023-gaid-2025-a-comprehensive-guide-to-nigerias-new-data-protection-landscape)). Counsel should confirm each against the Act and the GAID.

## 1. What we hold (from the code)

| Data | Where | Whose | Retention today |
|---|---|---|---|
| Name, email, phone, password hash | Account / User | Adult user | Until account deletion |
| Date of birth, sex, blood group, genotype, allergies, conditions, emergency contact, address | FamilyMember, child profile | Adult and child | Until deletion |
| Vaccinations (with verified/reported flag), growth measurements | ChildVaccination, ChildGrowth | Child | Until deletion |
| Developmental milestone answers, screening visits | ChildMilestone, ChildScreening | Child | Until deletion |
| School profile (school name, class, contacts) | childProfile.school | Child | Until deletion |
| Guardians, permissions, custody restrictions with reason and order reference | ChildGuardian | Adults and child | Until deletion |
| Access log (who viewed or changed a child's profile) | ChildAuditLog | Adults | Not yet limited. Decide |
| Reminder preferences, mobile number, SMS/WhatsApp consent time | ReminderPreference | Guardian | Until deletion |
| Reminder send log | ReminderLog | Guardian | 1 year (automatic) |
| Staff accounts and action log | StaffUser, StaffActionLog | Staff | Action log kept. Decide |
| App error reports (scrubbed of emails, numbers, ids, tokens) | ClientError | Anonymous | 30 days (automatic) |
| Medical records, prescriptions, lab results, appointments | various | Patient | Until deletion |

Health data is sensitive personal data under the Act. Children's data needs a lawful basis and a guardian's consent.

## 2. Third parties that receive personal data

Confirm each contract, location and transfer basis (Part VIII of the Act).
- Termii: mobile number and the reminder text (the child's first name and a dose count).
- Clerk: sign-in identity.
- LiveKit: video visit media.
- Render (API hosting) and the MongoDB host: all stored data. Confirm the region of each.
- Expo push notifications: push tokens and notification text.
- The email provider used by `sendWelliEmail`: email address and message.
Rule in the repo: health documents are never sent to third-party services. Reminders carry no vaccine names and no diagnosis.

## 3. Controls built

- Guardians and permissions, custody restrictions, access log, primary transfer (PR #15).
- Consent recorded with a timestamp before SMS or WhatsApp reminders.
- Staff accounts with roles, lockout and an action log (PR #20).
- Account deletion that reports server errors (CLAUDE.md rule).
- Offline data on the phone is cleared on sign out and account deletion.
- Error reports contain no ids, emails, numbers or tokens.

## 4. Draft DPIA

Large-scale processing of sensitive data triggers a DPIA (summary). Timing in the summary: within six months for processing that already exists, four months for sensitive-data software deployed after the GAID. Counsel to confirm which applies and the date.

| Risk | Likelihood / impact | Mitigation today | Gap |
|---|---|---|---|
| A separated parent gets a child's records | Medium / High | Permissions, restrictions, transfer by code, audit log | The app cannot verify a court order. Staff process for custody orders is not written |
| Staff misuse of access | Low / High | Roles, action log | Staff log is not reviewed on a schedule. No staff MFA |
| Phone lost with data on it | Medium / Medium | Secure storage, sign-out clears cache | No remote wipe |
| SMS reaches the wrong person | Medium / Medium | Number entered by the guardian, no vaccine names | No number verification by one-time code |
| Database breach | Low / High | Hosted database, hashed passwords | No encryption of individual fields, no tested restore, no penetration test |
| Reminder or milestone content read as medical advice | Medium / Medium | Draft status shown, no diagnosis | Clinician sign-off pending |
| Data kept too long | Medium / Medium | TTLs on logs | No policy for audit logs or inactive accounts |

## 5. Breach procedure (draft)

1. Whoever finds it tells the admin at once and writes down the time they became aware.
2. Contain it: disable the staff account or key, rotate `JWT_SECRET` or `ADMIN_SECRET` as needed (rotating `JWT_SECRET` signs everyone out).
3. Within 72 hours of becoming aware, notify the NDPC with: what happened, the kinds and approximate number of people affected, likely consequences, and what has been done (summary).
4. If the breach is likely to put people at high risk, tell them without delay, in plain language, and say what they should do.
5. Record the breach, the decision and the fix in a breach register. Review in 30 days.
Name an incident owner and a deputy before launch.

## 6. People's rights and how the app meets them

| Right | Today |
|---|---|
| See their data | Screens in the app. Full export is not built (FHIR export is next) |
| Correct it | Edit screens. Verified doses can only be changed by staff |
| Delete it | Account deletion in the app. Confirm backups and logs are covered |
| Move it | FHIR export planned |
| Withdraw consent | SMS and WhatsApp switches in the app. Other consents need a record |
| Children | A guardian acts for the child. The teen and adult hand-over exists (13 and 18) |

## 7. Questions for counsel

1. Are we a data controller or processor "of major importance", and which tier? When must we register and file the annual compliance audit return (summary: 31 March for the top tiers)?
2. Do we need a named DPO now? Who can be it?
3. What consent text and records do we need for sensitive data and for children, and at what age may a young person consent alone?
4. Is the hosting and SMS setup a cross-border transfer, and what is our basis?
5. Retention periods for health records, audit logs and inactive accounts.
6. Does the Nigerian health regulatory framework (for example the National Health Act, and professional rules for confidentiality) add duties for a patient-owned record that clinicians write into?
7. Privacy notice and terms wording, including the Play Store Data Safety answers.

## 8. Before launch (our side)

- Written privacy notice and a consent record for registration (check it stores the version accepted and the time).
- Named DPO and incident owner.
- Tested database restore.
- Penetration test.
- Staff multi-factor sign-in.
