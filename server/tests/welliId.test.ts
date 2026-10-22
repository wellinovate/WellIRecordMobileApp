import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { REGIONS, REGIONS_FINGERPRINT_SOURCE, resolveRegion, UNSPECIFIED_REGION } from '../data/nigeriaRegions';
import { formatWelliId, isWelliId, issueWelliId, parseWelliId, randomSuffix, SUFFIX_ALPHABET } from '../welliId';

// The same value must appear in the main backend, website and app tests.
const FINGERPRINT = crypto.createHash('sha256').update(REGIONS_FINGERPRINT_SOURCE).digest('hex');

test('there are 37 regions with unique three letter codes and unique names', () => {
  assert.equal(REGIONS.length, 37);
  assert.equal(new Set(REGIONS.map((r) => r.code)).size, 37);
  assert.equal(new Set(REGIONS.map((r) => r.name)).size, 37);
  for (const r of REGIONS) assert.match(r.code, /^[A-Z]{3}$/);
  assert.equal(REGIONS.some((r) => r.code === UNSPECIFIED_REGION.code), false);
});

test('region list fingerprint', () => {
  assert.equal(FINGERPRINT, FINGERPRINT_EXPECTED);
});

test('states resolve from common spellings; FCT is its own region', () => {
  assert.equal(resolveRegion('Lagos')?.code, 'LAG');
  assert.equal(resolveRegion('  lagos ')?.code, 'LAG');
  assert.equal(resolveRegion('Abuja')?.code, 'ABJ');
  assert.equal(resolveRegion('FCT')?.code, 'ABJ');
  assert.equal(resolveRegion('Federal Capital Territory')?.code, 'ABJ');
  assert.equal(resolveRegion('Akwa-Ibom')?.code, 'AKW');
  assert.equal(resolveRegion('Cross River')?.code, 'CRI');
  assert.equal(resolveRegion('Atlantis'), null);
  assert.equal(resolveRegion(''), null);
  assert.equal(resolveRegion(undefined), null);
});

test('an ID has the region, zone digit and a four character suffix with no look-alikes', () => {
  assert.equal(formatWelliId('ABJ', 1, '2RWR'), 'WR-ABJ1-2RWR');
  for (const c of '01OIL') assert.equal(SUFFIX_ALPHABET.includes(c), false);
  for (let i = 0; i < 200; i++) assert.match(randomSuffix(), /^[2-9A-HJKMNP-Z]{4}$/);
});

test('issueWelliId uses the state and retries on a clash', async () => {
  const taken = new Set<string>();
  let n = 0;
  const fixed = () => 0; // always the first letter: suffix 2222
  const first = await issueWelliId({ state: 'Lagos', exists: async (id) => taken.has(id), random: fixed });
  assert.equal(first.id, 'WR-LAG1-2222');
  assert.equal(first.hasRegion, true);
  taken.add(first.id);
  // Same random output again: zone 1 is full for that suffix, so it must not return the same ID.
  const seq = [0, 0, 0, 0, 1, 1, 1, 1];
  const second = await issueWelliId({ state: 'Lagos', exists: async (id) => taken.has(id), random: () => seq[n++ % seq.length] });
  assert.equal(second.id, 'WR-LAG1-3333');
});

test('when a zone is exhausted the next zone is used', async () => {
  const exists = async (id: string) => id.startsWith('WR-RIV1-');
  const r = await issueWelliId({ state: 'Rivers', exists });
  assert.match(r.id, /^WR-RIV2-/);
});

test('no state gives the "not stated" region, and failure to find a free ID throws', async () => {
  const r = await issueWelliId({ exists: async () => false });
  assert.match(r.id, /^WR-UNK1-/);
  assert.equal(r.hasRegion, false);
  await assert.rejects(issueWelliId({ state: 'Kano', exists: async () => true }));
});

test('parse reads the new format only; both formats pass isWelliId', () => {
  const p = parseWelliId('wr-abj1-2rwr');
  assert.equal(p?.regionCode, 'ABJ');
  assert.equal(p?.zone, 1);
  assert.equal(p?.region?.name, 'FCT, Abuja');
  assert.equal(parseWelliId('WR-4821-K3QZ'), null);
  assert.equal(parseWelliId('nonsense'), null);
  assert.equal(isWelliId('WR-ABJ1-2RWR'), true);
  assert.equal(isWelliId('WR-4821-K3QZ'), true);
  assert.equal(isWelliId('WR-ABJ-2RWR'), false);
});

const FINGERPRINT_EXPECTED = '78640607c1d0c7790b0f984666dd7705e0552cff2c54d461d413ee988ae76bec';
