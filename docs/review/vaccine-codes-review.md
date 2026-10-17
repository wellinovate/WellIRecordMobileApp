# Vaccine code mapping: clinician review sheet

Status: `pending_clinical_review` (`VACCINE_CODES_REVIEW` in `server/data/vaccineCodes.ts`).

The FHIR export sends our own schedule code on every dose and adds a CVX code beside it where one is mapped. CVX codes were read from the CDC CVX table in October 2026. SNOMED CT is not mapped: the concept IDs need a licensed terminology server to check.

For each row, confirm the product used in Nigeria matches the CVX code. Rows marked "none" are exported with the local code only.

| Schedule code | Dose | CVX | CVX name | Reviewer note |
|---|---|---|---|---|
| BCG-1 | BCG dose 1 | 19 | Bacillus Calmette-Guerin vaccine |  |
| OPV-0 | OPV birth dose | 178 | Non-US bivalent oral polio vaccine (types 1 and 3) | Assumes bivalent OPV, as used in Nigeria. 02 is trivalent and inactive. |
| HEPB-0 | Hepatitis B birth dose | 08 | Hepatitis B vaccine, pediatric or pediatric/adolescent dosage |  |
| PENTA-1 | Pentavalent dose 1 | 102 | DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine | CVX lists 102 as Non-US and withdrawn in 2007, but it is the only DTP-Hib-HepB code. |
| OPV-1 | OPV dose 1 | 178 | Non-US bivalent oral polio vaccine (types 1 and 3) | Same as OPV-0. |
| PCV-1 | PCV dose 1 | 133 | Pneumococcal conjugate vaccine, 13 valent | Assumes PCV13. PCV10 is 177. Confirm which product the programme uses. |
| ROTA-1 | Rotavirus dose 1 | 119 | Rotavirus, live, monovalent vaccine | Assumes monovalent. A pentavalent product would need another code. |
| PENTA-2 | Pentavalent dose 2 | 102 | DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine | Same as PENTA-1. |
| OPV-2 | OPV dose 2 | 178 | Non-US bivalent oral polio vaccine (types 1 and 3) | Same as OPV-0. |
| PCV-2 | PCV dose 2 | 133 | Pneumococcal conjugate vaccine, 13 valent | Same as PCV-1. |
| ROTA-2 | Rotavirus dose 2 | 119 | Rotavirus, live, monovalent vaccine | Same as ROTA-1. |
| PENTA-3 | Pentavalent dose 3 | 102 | DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine | Same as PENTA-1. |
| OPV-3 | OPV dose 3 | 178 | Non-US bivalent oral polio vaccine (types 1 and 3) | Same as OPV-0. |
| PCV-3 | PCV dose 3 | 133 | Pneumococcal conjugate vaccine, 13 valent | Same as PCV-1. |
| IPV-1 | IPV dose 1 | 10 | Poliovirus vaccine, inactivated |  |
| MCV-1 | Measles-containing vaccine dose 1 | 04 | Measles and rubella virus vaccine | Assumes measles-rubella (MR). CVX marks 04 inactive. Measles-only is 05. |
| YF-1 | Yellow fever dose 1 | 37 | Yellow fever vaccine live |  |
| VITA-1 | Vitamin A dose 1 | none |  | Vitamin A is a supplement, not a vaccine. |
| MENA-1 | Meningococcal conjugate dose 1 | none |  | No code found for meningococcal A conjugate (MenAfriVac). The CVX meningococcal entries found were ACWY or unspecified. |
| MALARIA-1 | Malaria vaccine (R21) dose 1 | none |  | CVX 67 is a generic malaria entry marked never active. No R21 code found. |
| MALARIA-2 | Malaria vaccine (R21) dose 2 | none |  | Same as MALARIA-1. |
| MALARIA-3 | Malaria vaccine (R21) dose 3 | none |  | Same as MALARIA-1. |
| MALARIA-4 | Malaria vaccine (R21) dose 4 | none |  | Same as MALARIA-1. |
| MCV-2 | Measles-containing vaccine, second dose dose 2 | 04 | Measles and rubella virus vaccine | Same as MCV-1. Use 03 if the product is MMR. |
| HPV-1 | HPV dose 1 | 165 | HPV9 | Assumes the 9-valent product. 62 is quadrivalent. Confirm the product in use. |

Sign-off: set `reviewStatus: 'reviewed'`, `reviewedBy` and `reviewedOn`.
