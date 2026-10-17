import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { childToFhirBundle, fhirGender, hasAllergyText, LOINC } from '../fhir';

const child = {
  id: 'c1',
  wrId: 'WR-ABC123',
  fullName: 'Ada Okafor',
  dateOfBirth: '2026-05-01',
  gender: 'Female',
  allergies: 'Penicillin',
  childProfile: { birthRegistrationNo: 'BR-9', lga: 'Gwagwalada', state: 'FCT', emergencyContact: { name: 'Chidi', relationship: 'Father', phone: '08031234567' } },
};
const vax = (over: any = {}) => ({ id: 'v1', vaccineCode: 'BCG-1', vaccineName: 'BCG', administeredDate: '2026-05-02', verification: 'caregiver_reported' as const, ...over });

describe('FHIR export', () => {
  it('builds a collection bundle with the Patient first', () => {
    const b: any = childToFhirBundle(child, [], [], new Date('2026-10-17T10:00:00Z'));
    assert.equal(b.resourceType, 'Bundle');
    assert.equal(b.type, 'collection');
    assert.equal(b.timestamp, '2026-10-17T10:00:00.000Z');
    assert.equal(b.entry[0].resource.resourceType, 'Patient');
    const p = b.entry[0].resource;
    assert.equal(p.gender, 'female');
    assert.equal(p.birthDate, '2026-05-01');
    assert.equal(p.identifier[0].value, 'WR-ABC123');
    assert.equal(p.identifier[1].value, 'BR-9');
    assert.equal(p.contact[0].telecom[0].value, '08031234567');
  });

  it('marks a parent-reported dose as not primary source and a clinic dose as primary', () => {
    const b: any = childToFhirBundle(child, [vax(), vax({ id: 'v2', vaccineCode: 'OPV-0', vaccineName: 'OPV', verification: 'provider_verified', verifiedBy: 'Dr Bello' })], []);
    const imms = b.entry.map((e: any) => e.resource).filter((r: any) => r.resourceType === 'Immunization');
    assert.equal(imms[0].primarySource, false);
    assert.equal(imms[0].reportOrigin.text, 'Parent or guardian report');
    assert.equal(imms[1].primarySource, true);
    assert.equal(imms[1].performer[0].actor.display, 'Dr Bello');
    assert.equal(imms[0].meta.tag[0].code, 'caregiver_reported');
    assert.equal(imms[1].meta.tag[0].code, 'provider_verified');
  });

  it('writes one Observation per measurement with LOINC codes and UCUM units', () => {
    const b: any = childToFhirBundle(child, [], [{ id: 'g1', measuredOn: '2026-08-01', weightKg: 6.4, lengthCm: 61, headCircumferenceCm: null, source: 'clinic' }]);
    const obs = b.entry.map((e: any) => e.resource).filter((r: any) => r.resourceType === 'Observation');
    assert.equal(obs.length, 2);
    assert.equal(obs[0].code.coding[0].code, LOINC.weight.code);
    assert.equal(obs[0].valueQuantity.value, 6.4);
    assert.equal(obs[0].valueQuantity.code, 'kg');
    assert.equal(obs[1].code.coding[0].code, LOINC.height.code);
    assert.equal(obs[0].meta.tag[0].code, 'provider_verified');
  });

  it('only exports allergies that are real text', () => {
    assert.equal(hasAllergyText('None'), false);
    assert.equal(hasAllergyText('NKDA'), false);
    assert.equal(hasAllergyText(''), false);
    assert.equal(hasAllergyText('Penicillin rash'), true);
    const without: any = childToFhirBundle({ ...child, allergies: 'None' }, [], []);
    assert.equal(without.entry.some((e: any) => e.resource.resourceType === 'AllergyIntolerance'), false);
    const withAllergy: any = childToFhirBundle(child, [], []);
    assert.equal(withAllergy.entry.find((e: any) => e.resource.resourceType === 'AllergyIntolerance').resource.verificationStatus.coding[0].code, 'unconfirmed');
  });

  it('maps sex values and defaults to unknown', () => {
    assert.equal(fhirGender('Male'), 'male');
    assert.equal(fhirGender('f'), 'female');
    assert.equal(fhirGender(''), 'unknown');
    assert.equal(fhirGender('Other'), 'unknown');
  });

  it('keeps vaccine codes in a local system, not an international one', () => {
    const b: any = childToFhirBundle(child, [vax()], []);
    const imm = b.entry.find((e: any) => e.resource.resourceType === 'Immunization').resource;
    assert.equal(imm.vaccineCode.coding[0].system, 'https://welli.record/CodeSystem/ng-immunization-schedule');
  });
});
