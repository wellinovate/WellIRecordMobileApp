import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { REGIONS, REGIONS_FINGERPRINT_SOURCE, STATE_NAMES, resolveRegion } from '../src/data/nigeriaRegions';

test('the app copy of the region list matches the server list', () => {
  const h = crypto.createHash('sha256').update(REGIONS_FINGERPRINT_SOURCE).digest('hex');
  assert.equal(h, '78640607c1d0c7790b0f984666dd7705e0552cff2c54d461d413ee988ae76bec');
  assert.equal(REGIONS.length, 37);
});

test('pickers list 37 names, sorted, and every name resolves to its own region', () => {
  assert.equal(STATE_NAMES.length, 37);
  assert.deepEqual([...STATE_NAMES], [...STATE_NAMES].sort((a, b) => a.localeCompare(b)));
  for (const r of REGIONS) assert.equal(resolveRegion(r.name)?.code, r.code);
});
