import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDoseRows, summarize } from '../src/utils/immunization';
import type { ImmunizationSchedule } from '../src/utils/immunization';

const schedule: ImmunizationSchedule = {
  country: 'NG', version: 't', reviewStatus: 'pending_clinical_review', reviewedBy: null, reviewedOn: null, sources: [], notes: [],
  doses: [
    { code: 'A', vaccine: 'A', antigen: 'a', doseNumber: 1, dueDays: 0, graceDays: 7, track: 'routine' },
    { code: 'B', vaccine: 'B', antigen: 'b', doseNumber: 1, dueDays: 42, graceDays: 30, track: 'routine' },
    { code: 'C', vaccine: 'C', antigen: 'c', doseNumber: 1, dueDays: 270, graceDays: 30, track: 'routine' },
    { code: 'P', vaccine: 'P', antigen: 'p', doseNumber: 1, dueDays: 100, graceDays: 30, track: 'programme' },
  ],
};

describe('buildDoseRows', () => {
  it('shows an old child with no records as not recorded, never overdue', () => {
    const rows = buildDoseRows(schedule, '2017-02-03', [], '2026-10-23');
    assert.deepEqual(rows.map((r) => r.status), ['notRecorded', 'notRecorded', 'notRecorded', 'programme']);
    assert.deepEqual(summarize(rows), { completed: 0, upcoming: 0, notRecorded: 3, unverified: 0 });
  });
  it('shows a newborn with mostly upcoming doses', () => {
    const rows = buildDoseRows(schedule, '2026-10-20', [], '2026-10-23');
    assert.deepEqual(rows.map((r) => r.status), ['due', 'upcoming', 'upcoming', 'programme']);
  });
  it('counts recorded doses', () => {
    const rec: any = { vaccineCode: 'A', verification: 'provider_verified' };
    const rows = buildDoseRows(schedule, '2017-02-03', [rec], '2026-10-23');
    assert.equal(rows[0].status, 'verified');
    assert.equal(summarize(rows).completed, 1);
  });
});
