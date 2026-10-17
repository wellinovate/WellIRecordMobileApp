// FHIR R4 export for a child's record.
//
// Builds a `collection` Bundle from what the app holds: the child as a Patient,
// vaccine doses as Immunization, growth as Observation (LOINC vital signs) and
// recorded allergies as AllergyIntolerance. Pure functions, no database access.
//
// What it does not claim: our schedule code is always sent. A CVX code is added where
// data/vaccineCodes.ts has one, and that mapping is pending clinical review. SNOMED is not mapped. Whether a dose
// was reported by a parent or confirmed by a clinic is carried as a tag and in
// Immunization.primarySource, so a receiving system can tell them apart.

import { CVX_SYSTEM, cvxFor } from './data/vaccineCodes';

export const SYSTEM = {
  welliId: 'https://welli.record/id/welli-id',
  birthRegistration: 'https://welli.record/id/birth-registration',
  schedule: 'https://welli.record/CodeSystem/ng-immunization-schedule',
  verification: 'https://welli.record/CodeSystem/verification',
  loinc: 'http://loinc.org',
  ucum: 'http://unitsofmeasure.org',
  obsCategory: 'http://terminology.hl7.org/CodeSystem/observation-category',
  allergyClinical: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
  allergyVerification: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
} as const;

export const LOINC = {
  weight: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  height: { code: '8302-2', display: 'Body height', unit: 'cm' },
  head: { code: '9843-4', display: 'Head Occipital-frontal circumference', unit: 'cm' },
} as const;

export interface FhirChild {
  id: string;
  wrId?: string | null;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string;
  bloodType?: string;
  genotype?: string;
  allergies?: string;
  childProfile?: any;
}

export interface FhirVaccination {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  facility?: string;
  provider?: string;
  lotNumber?: string;
  manufacturer?: string;
  expiryDate?: string;
  site?: string;
  route?: string;
  reaction?: string;
  notes?: string;
  verification: 'caregiver_reported' | 'provider_verified';
  verifiedBy?: string;
}

export interface FhirGrowth {
  id: string;
  measuredOn: string;
  weightKg?: number | null;
  lengthCm?: number | null;
  headCircumferenceCm?: number | null;
  source: 'caregiver' | 'clinic';
  notes?: string;
}

export function fhirGender(g?: string): 'male' | 'female' | 'unknown' {
  const v = String(g || '').trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  return 'unknown';
}

/** Free text such as "None" or "NKDA" is not an allergy. */
export function hasAllergyText(text?: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return !/^(none|nil|nkda|nka|no known( drug)? allergies|no allergies|n\/a|not recorded)\.?$/i.test(t);
}

const ref = (type: string, id: string) => ({ reference: `${type}/${id}` });
const verificationTag = (v: string) => ({ system: SYSTEM.verification, code: v });

export function patientResource(c: FhirChild) {
  const p = c.childProfile || {};
  const ec = p.emergencyContact || {};
  const identifier: any[] = [];
  if (c.wrId) identifier.push({ system: SYSTEM.welliId, value: c.wrId });
  if (p.birthRegistrationNo) identifier.push({ system: SYSTEM.birthRegistration, value: p.birthRegistrationNo });
  const address = [p.address, p.community, p.lga, p.state].filter(Boolean);
  const res: any = {
    resourceType: 'Patient',
    id: c.id,
    identifier,
    name: [{ text: c.fullName }],
    gender: fhirGender(c.gender),
  };
  if (c.dateOfBirth) res.birthDate = c.dateOfBirth;
  if (address.length) res.address = [{ text: address.join(', '), district: p.lga || undefined, state: p.state || undefined, country: 'NG' }];
  if (ec.name || ec.phone) {
    res.contact = [
      {
        relationship: ec.relationship ? [{ text: ec.relationship }] : undefined,
        name: ec.name ? { text: ec.name } : undefined,
        telecom: ec.phone ? [{ system: 'phone', value: ec.phone }] : undefined,
      },
    ];
  }
  if (p.preferredName) res.name.push({ use: 'usual', text: p.preferredName });
  return res;
}

export function immunizationResource(v: FhirVaccination, patientId: string) {
  const verified = v.verification === 'provider_verified';
  const res: any = {
    resourceType: 'Immunization',
    id: v.id,
    meta: { tag: [verificationTag(v.verification)] },
    status: 'completed',
    vaccineCode: {
      text: v.vaccineName,
      coding: [
        { system: SYSTEM.schedule, code: v.vaccineCode, display: v.vaccineName },
        ...(cvxFor(v.vaccineCode) ? [{ system: CVX_SYSTEM, code: cvxFor(v.vaccineCode)!.cvx, display: cvxFor(v.vaccineCode)!.display }] : []),
      ],
    },
    patient: ref('Patient', patientId),
    occurrenceDateTime: v.administeredDate,
    primarySource: verified,
  };
  if (!verified) res.reportOrigin = { text: 'Parent or guardian report' };
  if (v.lotNumber) res.lotNumber = v.lotNumber;
  if (v.expiryDate) res.expirationDate = v.expiryDate;
  if (v.manufacturer) res.manufacturer = { display: v.manufacturer };
  if (v.site) res.site = { text: v.site };
  if (v.route) res.route = { text: v.route };
  if (v.facility) res.location = { display: v.facility };
  const performer = verified ? v.verifiedBy || v.provider : v.provider;
  if (performer) res.performer = [{ actor: { display: performer } }];
  const notes = [v.reaction ? `Reaction: ${v.reaction}` : '', v.notes || ''].filter(Boolean);
  if (notes.length) res.note = notes.map((text) => ({ text }));
  return res;
}

export function growthResources(g: FhirGrowth, patientId: string) {
  const out: any[] = [];
  const add = (key: 'weight' | 'height' | 'head', value?: number | null) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
    const l = LOINC[key];
    out.push({
      resourceType: 'Observation',
      id: `${g.id}-${key}`,
      meta: { tag: [verificationTag(g.source === 'clinic' ? 'provider_verified' : 'caregiver_reported')] },
      status: 'final',
      category: [{ coding: [{ system: SYSTEM.obsCategory, code: 'vital-signs' }] }],
      code: { coding: [{ system: SYSTEM.loinc, code: l.code, display: l.display }], text: l.display },
      subject: ref('Patient', patientId),
      effectiveDateTime: g.measuredOn,
      valueQuantity: { value: Number(value), unit: l.unit, system: SYSTEM.ucum, code: l.unit },
      note: g.notes ? [{ text: g.notes }] : undefined,
    });
  };
  add('weight', g.weightKg);
  add('height', g.lengthCm);
  add('head', g.headCircumferenceCm);
  return out;
}

export function allergyResource(c: FhirChild) {
  if (!hasAllergyText(c.allergies)) return null;
  return {
    resourceType: 'AllergyIntolerance',
    id: `${c.id}-allergies`,
    clinicalStatus: { coding: [{ system: SYSTEM.allergyClinical, code: 'active' }] },
    verificationStatus: { coding: [{ system: SYSTEM.allergyVerification, code: 'unconfirmed' }] },
    code: { text: String(c.allergies).trim() },
    patient: ref('Patient', c.id),
  };
}

export function childToFhirBundle(
  child: FhirChild,
  vaccinations: FhirVaccination[],
  growth: FhirGrowth[],
  now: Date = new Date()
) {
  const resources: any[] = [patientResource(child)];
  const allergy = allergyResource(child);
  if (allergy) resources.push(allergy);
  for (const v of vaccinations) resources.push(immunizationResource(v, child.id));
  for (const g of growth) resources.push(...growthResources(g, child.id));
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: now.toISOString(),
    meta: { tag: [{ system: 'https://welli.record/CodeSystem/export', code: 'child-record-v1' }] },
    entry: resources.map((resource) => ({ fullUrl: `urn:welli:${resource.resourceType}:${resource.id}`, resource })),
  };
}
