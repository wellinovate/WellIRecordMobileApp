import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IMMUNIZATION_SCHEDULE } from '../data/immunizationSchedule';
import { CVX_BY_SCHEDULE_CODE, CVX_SYSTEM, VACCINE_CODES_REVIEW } from '../data/vaccineCodes';
import { childToFhirBundle } from '../fhir';

describe('CVX mapping', () => {
  it('has an entry, mapped or deliberately empty, for every schedule dose and none for unknown doses', () => {
    const codes = IMMUNIZATION_SCHEDULE.doses.map((d) => d.code).sort();
    assert.deepEqual(Object.keys(CVX_BY_SCHEDULE_CODE).sort(), codes);
  });
  it('uses well-formed CVX codes and explains every empty entry', () => {
    for (const [k, e] of Object.entries(CVX_BY_SCHEDULE_CODE)) {
      if (e.cvx === null) assert.ok(e.note, `${k} needs a reason`);
      else assert.match(e.cvx, /^\d{2,3}$/, k);
    }
  });
  it('stays pending review until someone signs it off', () => {
    assert.equal(VACCINE_CODES_REVIEW.reviewStatus, 'pending_clinical_review');
  });
  it('adds CVX beside the local code in the export, and only where mapped', () => {
    const b: any = childToFhirBundle(
      { id: 'c1', fullName: 'Ada', dateOfBirth: '2026-01-01', gender: 'Female' } as any,
      [
        { id: 'v1', vaccineCode: 'BCG-1', vaccineName: 'BCG', administeredDate: '2026-01-02', verification: 'provider_verified' },
        { id: 'v2', vaccineCode: 'VITA-1', vaccineName: 'Vitamin A', administeredDate: '2026-07-02', verification: 'caregiver_reported' },
      ] as any,
      []
    );
    const imms = b.entry.map((e: any) => e.resource).filter((r: any) => r.resourceType === 'Immunization');
    assert.deepEqual(imms[0].vaccineCode.coding.map((c: any) => c.system).slice(1), [CVX_SYSTEM]);
    assert.equal(imms[0].vaccineCode.coding[1].code, '19');
    assert.equal(imms[1].vaccineCode.coding.length, 1);
  });
});
