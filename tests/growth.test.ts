import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WHO_GROWTH, type GrowthMetric, type GrowthSex } from '../src/data/whoGrowth';
import {
  ageInMonths, bandOf, correctedAge, curves, needsCorrection, lmsAt, percentileOf, placeMeasurement, sexKey, tableFor, valueAtZ, zScore,
} from '../src/utils/growth';

const SEXES: GrowthSex[] = ['boys', 'girls'];
const METRICS: GrowthMetric[] = ['weight', 'length', 'height', 'head'];

describe('WHO tables', () => {
  it('have the expected number of rows and plausible L, M and S', () => {
    const rows = { weight: 61, head: 61, length: 25, height: 37 };
    for (const s of SEXES)
      for (const m of METRICS) {
        const t = WHO_GROWTH[s][m];
        assert.equal(t.lms.length, rows[m], `${s} ${m}`);
        assert.equal(t.sd.length, rows[m]);
        for (const [L, M, S] of t.lms) {
          assert.ok(Number.isFinite(L) && Number.isFinite(M) && Number.isFinite(S));
          assert.ok(M > 0 && S > 0 && S < 0.3);
        }
      }
    assert.equal(WHO_GROWTH.boys.height.start, 24);
  });

  it('start with the published birth values', () => {
    assert.deepEqual(WHO_GROWTH.boys.weight.lms[0], [0.3487, 3.3464, 0.14602]);
    assert.deepEqual(WHO_GROWTH.girls.weight.lms[0], [0.3809, 3.2322, 0.14171]);
    assert.equal(WHO_GROWTH.boys.length.lms[0][1], 49.8842);
    assert.equal(WHO_GROWTH.girls.head.lms[0][1], 33.8787);
  });

  it('give the same -3, -2, 0, +2 and +3 SD values as the published rounded tables, in every row', () => {
    // This checks both the data and the formula against an independent column of the same file.
    for (const s of SEXES)
      for (const m of METRICS) {
        const t = WHO_GROWTH[s][m];
        t.lms.forEach((lms, i) => {
          [-3, -2, 0, 2, 3].forEach((z, k) => {
            const got = valueAtZ(lms, z);
            assert.ok(Math.abs(got - t.sd[i][k]) <= 0.06, `${s} ${m} month ${t.start + i} z=${z}: ${got} vs ${t.sd[i][k]}`);
          });
        });
      }
  });

  it('use a lying-down table before 24 months and a standing table from 24', () => {
    assert.equal(tableFor('length', 'boys', 23.9), WHO_GROWTH.boys.length);
    assert.equal(tableFor('length', 'boys', 24), WHO_GROWTH.boys.height);
    // WHO: standing height is 0.7 cm lower than lying length at 24 months
    const l = WHO_GROWTH.boys.length.lms[24][1];
    const h = WHO_GROWTH.boys.height.lms[0][1];
    assert.ok(Math.abs(l - h - 0.7) < 0.001);
  });
});

describe('z-score and percentile', () => {
  const lms = WHO_GROWTH.boys.weight.lms[12];
  it('is 0 at the median and round-trips through valueAtZ', () => {
    assert.ok(Math.abs(zScore(lms[1], lms)) < 1e-9);
    for (const z of [-2.5, -1, 0.7, 1.9]) assert.ok(Math.abs(zScore(valueAtZ(lms, z), lms) - z) < 1e-9);
  });
  it('matches the published boys weight at 12 months', () => {
    assert.ok(Math.abs(lms[1] - 9.6479) < 0.0001);
  });
  it('handles L = 0 with the log form', () => {
    const l0: [number, number, number] = [0, 10, 0.1];
    assert.ok(Math.abs(zScore(10 * Math.exp(0.1 * 1.5), l0) - 1.5) < 1e-9);
    assert.ok(Math.abs(valueAtZ(l0, 1.5) - 10 * Math.exp(0.15)) < 1e-9);
  });
  it('extends beyond +-3 SD linearly for weight', () => {
    const sd3 = valueAtZ(lms, 3);
    const sd2 = valueAtZ(lms, 2);
    const step = sd3 - sd2;
    assert.ok(Math.abs(zScore(sd3 + step, lms, true) - 4) < 1e-9);
    assert.ok(Math.abs(zScore(sd3 + step, lms, false) - 4) > 0.01);
    const n3 = valueAtZ(lms, -3);
    assert.ok(Math.abs(zScore(n3 - (valueAtZ(lms, -2) - n3), lms, true) + 4) < 1e-9);
  });
  it('percentiles are right at known points', () => {
    assert.ok(Math.abs(percentileOf(0) - 50) < 0.001);
    assert.ok(Math.abs(percentileOf(1.6449) - 95) < 0.01);
    assert.ok(Math.abs(percentileOf(-1.96) - 2.5) < 0.01);
    assert.ok(Math.abs(percentileOf(2) - 97.725) < 0.01);
  });
});

describe('age and placing a measurement', () => {
  it('computes age in months', () => {
    assert.ok(Math.abs(ageInMonths('2026-01-01', '2027-01-01')! - 11.99) < 0.05);
    assert.equal(ageInMonths('2026-01-01', '2025-12-31'), null);
    assert.equal(ageInMonths('', '2026-01-01'), null);
    assert.equal(ageInMonths('2026-02-30x', '2026-03-01'), null);
  });
  it('interpolates between months and refuses ages outside 0 to 60', () => {
    const t = WHO_GROWTH.girls.weight;
    const mid = lmsAt(t, 6.5)!;
    assert.ok(Math.abs(mid[1] - (t.lms[6][1] + t.lms[7][1]) / 2) < 1e-9);
    assert.equal(lmsAt(t, 60.5), null);
    assert.equal(lmsAt(t, -0.1), null);
    assert.notEqual(lmsAt(t, 60), null);
  });
  it('puts a median baby at the 50th percentile and flags big departures', () => {
    const dob = '2026-01-01';
    const median = placeMeasurement('weight', 'Male', dob, '2026-01-01', 3.3464)!;
    assert.ok(Math.abs(median.z) < 1e-9);
    assert.equal(median.band, 'usual');
    const low = placeMeasurement('weight', 'Male', dob, '2026-01-01', 2.2)!;
    assert.ok(low.z < -2);
    assert.ok(['low', 'far_low'].includes(low.band));
    const typo = placeMeasurement('weight', 'Male', dob, '2026-01-01', 33.4)!;
    assert.equal(typo.band, 'implausible');
  });
  it('returns nothing when sex is unknown, the child is over five, or the value is missing', () => {
    assert.equal(placeMeasurement('weight', '', '2026-01-01', '2026-02-01', 4), null);
    assert.equal(placeMeasurement('weight', 'Female', '2020-01-01', '2026-02-01', 20), null);
    assert.equal(placeMeasurement('head', 'Female', '2026-01-01', '2026-02-01', null), null);
    assert.equal(placeMeasurement('head', 'Female', '2026-01-01', '2026-02-01', 0), null);
  });
  it('maps sex values', () => {
    assert.equal(sexKey('Female'), 'girls');
    assert.equal(sexKey('male'), 'boys');
    assert.equal(sexKey('Other'), null);
  });
  it('bands cut at -3, -2, 2 and 3', () => {
    assert.equal(bandOf('weight', 0), 'usual');
    assert.equal(bandOf('weight', -2), 'usual');
    assert.equal(bandOf('weight', -2.01), 'low');
    assert.equal(bandOf('weight', -3.01), 'far_low');
    assert.equal(bandOf('weight', 2.01), 'high');
    assert.equal(bandOf('weight', 3.01), 'far_high');
    assert.equal(bandOf('weight', 5.1), 'implausible');
    assert.equal(bandOf('length', -6.1), 'implausible');
  });
});

describe('chart curves', () => {
  it('give five lines of 61 points that rise with z', () => {
    for (const metric of ['weight', 'length', 'head'] as const) {
      const c = curves(metric, 'girls');
      assert.equal(c.length, 5);
      c.forEach((line) => assert.equal(line.points.length, 61));
      for (let i = 1; i < c.length; i++) assert.ok(c[i].points[30].y > c[i - 1].points[30].y);
    }
  });
});

describe('corrected age', () => {
  it('applies only under 37 weeks and under 24 months', () => {
    assert.equal(needsCorrection(5, 32), true);
    assert.equal(needsCorrection(5, 37), false);
    assert.equal(needsCorrection(5, 40), false);
    assert.equal(needsCorrection(24, 32), false);
    assert.equal(needsCorrection(5, null), false);
    assert.equal(needsCorrection(5, 12), false, 'implausible gestation is ignored');
  });
  it('subtracts the weeks missing from 40', () => {
    // 8 weeks early is about 1.84 months
    assert.ok(Math.abs(correctedAge(6, 32) - (6 - 8 / (30.4375 / 7))) < 1e-9);
    assert.ok(Math.abs(correctedAge(6, 32) - 4.16) < 0.01);
  });
  it('reads a preterm baby at the corrected age and can be turned off', () => {
    const dob = '2026-01-01';
    const on = '2026-05-01'; // about 3.97 months from birth, born at 32 weeks
    const w = 6.0;
    const corr = placeMeasurement('weight', 'Female', dob, on, w, { gestationalAgeWeeks: 32 })!;
    const raw = placeMeasurement('weight', 'Female', dob, on, w, { gestationalAgeWeeks: 32, correct: false })!;
    assert.equal(corr.corrected, true);
    assert.equal(raw.corrected, false);
    assert.ok(corr.ageMonths < raw.ageMonths - 1.5);
    assert.ok(corr.z > raw.z, 'same weight is further up the chart at the younger age');
    assert.ok(Math.abs(corr.chronologicalMonths - raw.ageMonths) < 1e-9);
  });
  it('leaves off readings taken before the due date', () => {
    assert.equal(placeMeasurement('weight', 'Male', '2026-01-01', '2026-01-20', 1.8, { gestationalAgeWeeks: 30 }), null);
  });
  it('does not change a term baby', () => {
    const a = placeMeasurement('weight', 'Male', '2026-01-01', '2026-04-01', 6, { gestationalAgeWeeks: 40 })!;
    const b = placeMeasurement('weight', 'Male', '2026-01-01', '2026-04-01', 6)!;
    assert.equal(a.z, b.z);
  });
});
