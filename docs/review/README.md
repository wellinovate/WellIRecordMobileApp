# Clinical review

The workbook `WelliRecord_clinical_review.xlsx` (not stored in the repo, because the repo's Git LFS rule covers spreadsheets; generate it with the two commands below) lists every row of the immunization schedule (25 doses) and the milestone checklist (159 items) exactly as the app uses them, with columns for a clinician to mark Correct, Change or Remove, cite a source and comment. It has a sign-off tab.

## Process
1. Send the workbook to a Nigerian paediatrician (and, for vaccines, someone who works with the NPHCDA routine schedule). Ask for the Read me tab to be followed.
2. When it comes back, apply the changes in `server/data/immunizationSchedule.ts` and `server/data/milestones.ts`, bump `version`, and set `reviewStatus: 'reviewed'`, `reviewedBy`, `reviewedOn` from the Sign-off tab.
3. Keep the signed workbook in the company records. The app shows "pending clinical review" until step 2.

Generate or regenerate it after any data change:
```bash
cd docs/review && npx tsx export_catalogues.ts && python3 build_review_workbook.py
```
The first command writes `data.json` from the live catalogues; the second reads it.

## Message to send with it
> Hello Dr ___,
> WelliRecord is a patient-owned health record app. It shows parents a childhood vaccine schedule and a developmental checklist. Both are drafts from public sources and are labelled as unreviewed in the app. Could you review the attached workbook against the current NPHCDA schedule and your clinical judgment? Please mark each row, cite a source for changes, and complete the Sign-off tab. We will not mark either list as reviewed until you have. About 25 vaccine rows and 159 milestone rows; the vaccine tab is the priority.
> Thank you, Welli Jay, Wellinovate Limited
