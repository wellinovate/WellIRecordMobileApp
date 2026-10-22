import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapLga, normalizeLga } from '../lgaCore';
import { LGAS } from '../data/nigeriaLgas';

test('normalising drops suffix words, case and punctuation', () => {
  assert.equal(normalizeLga('Abuja Municipal Area Council'), 'abuja municipal');
  assert.equal(normalizeLga(' A.M.A.C '), 'a m a c');
  assert.equal(normalizeLga('Kuje L.G.A.'), 'kuje');
});

test('exact name or alias in the right state is verified with a code', () => {
  assert.deepEqual(mapLga('ABJ', 'amac'), { lgaText: 'amac', lgaCode: 'ABJ-AMAC', lgaMappingStatus: 'verified' });
  assert.equal(mapLga('ABJ', 'Abuja Municipal Area Council').lgaCode, 'ABJ-AMAC');
  assert.equal(mapLga('ABJ', 'Kuje Local Government').lgaCode, 'ABJ-KUJE');
});

test('a picked code from the same state is verified; from another state it is ignored', () => {
  assert.equal(mapLga('ABJ', '', 'ABJ-BWARI').lgaCode, 'ABJ-BWARI');
  assert.equal(mapLga('LAG', 'Bwari', 'ABJ-BWARI').lgaCode, '');
});

test('no guess: near matches and unknown text get no code', () => {
  assert.deepEqual(mapLga('ABJ', 'Garki'), { lgaText: 'Garki', lgaCode: '', lgaMappingStatus: 'needs_review' });
  assert.equal(mapLga('ABJ', 'Kujee').lgaCode, '');
});

test('a state with no catalogue stays unverified and never blocks', () => {
  assert.deepEqual(mapLga('LAG', 'Ikeja'), { lgaText: 'Ikeja', lgaCode: '', lgaMappingStatus: 'unverified' });
  assert.deepEqual(mapLga('UNK', ''), { lgaText: '', lgaCode: '', lgaMappingStatus: 'unverified' });
});

test('catalogue codes are unique and start with their region', () => {
  assert.equal(new Set(LGAS.map((l) => l.code)).size, LGAS.length);
  for (const l of LGAS) assert.ok(l.code.startsWith(`${l.region}-`));
});
