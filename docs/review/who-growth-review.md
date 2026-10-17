# WHO growth charts: clinician review sheet

Status: `pending_clinical_review` (`WHO_GROWTH_REVIEW` in `src/data/whoGrowth.ts`).

## What to check

1. Tables. `src/data/whoGrowth.ts` holds the WHO Child Growth Standards L, M, S values for weight-for-age, length/height-for-age and head-circumference-for-age, boys and girls, 0 to 60 months. Spot-check a few rows against the WHO tables (who.int/tools/child-growth-standards). Tests also check every row against the published rounded -3/-2/0/+2/+3 SD columns.
2. Length vs height. Lying length is used under 24 months and standing height from 24 months. WHO's 0.7 cm difference at 24 months is tested.
3. Bands. Within range: -2 to +2 SD. Below/above: beyond 2 SD. Well below/above: beyond 3 SD. Implausible (likely typing error): weight outside -6/+5, length outside -6/+6, head outside -5/+5 SD.
4. Weight beyond +-3 SD uses WHO's linear adjustment.
5. Corrected age. For children born before 37 weeks and under 24 months, age is counted from the due date (40 weeks minus gestational age, subtracted from age). The parent can switch it off. Readings taken before the due date are left off, since the WHO standard starts at term. Confirm the 37-week and 24-month cut-offs, and whether preterm-specific charts are wanted.
6. Not covered: weight-for-length, BMI-for-age, over 5 years, children with conditions that have their own charts.

## Wording shown to parents

| Band | Text |
|---|---|
| usual | Within the usual range for age. |
| low | Below the usual range for age. This is a reason to ask your clinic. It is not a diagnosis. |
| far_low | Well below the usual range for age. Ask your clinic about this soon. It is not a diagnosis. |
| high | Above the usual range for age. Mention it at the next clinic visit. It is not a diagnosis. |
| far_high | Well above the usual range for age. Ask your clinic about this soon. It is not a diagnosis. |
| implausible | This number looks unlikely for this age. Check it was typed correctly. |

Sign-off: set `reviewStatus: 'reviewed'`, `reviewedBy`, `reviewedOn` in `WHO_GROWTH_REVIEW`.
