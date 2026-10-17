import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampHours, DEFAULT_HOURS, grantState, hashCode, MAX_HOURS, newFacilityCode, normaliseWrId } from '../childFacility';

describe('facility codes', () => {
  it('are 8 characters from an alphabet without look-alikes', () => {
    for (let i = 0; i < 200; i++) assert.match(newFacilityCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
  });
  it('differ from one call to the next', () => {
    assert.notEqual(newFacilityCode(), newFacilityCode());
  });
  it('hash the same however the clinic types them, and differ by secret', () => {
    assert.equal(hashCode('s', 'ab12-cd34'), hashCode('s', 'AB12CD34'));
    assert.equal(hashCode('s', ' ab12 cd34 '), hashCode('s', 'AB12CD34'));
    assert.notEqual(hashCode('s', 'AB12CD34'), hashCode('t', 'AB12CD34'));
    assert.notEqual(hashCode('s', 'AB12CD34'), hashCode('s', 'AB12CD35'));
  });
  it('do not store the code itself', () => {
    assert.ok(!hashCode('s', 'AB12CD34').includes('AB12CD34'));
  });
});

describe('facility grants', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  it('are active until they expire or are revoked', () => {
    assert.equal(grantState({ expiresAt: new Date('2026-10-18T12:00:00Z') }, now), 'active');
    assert.equal(grantState({ expiresAt: new Date('2026-10-17T11:59:59Z') }, now), 'expired');
    assert.equal(grantState({ expiresAt: new Date('2026-10-18T12:00:00Z'), revokedAt: now }, now), 'revoked');
  });
  it('limit the validity period', () => {
    assert.equal(clampHours(undefined), DEFAULT_HOURS);
    assert.equal(clampHours('abc'), DEFAULT_HOURS);
    assert.equal(clampHours(-5), DEFAULT_HOURS);
    assert.equal(clampHours(2), 2);
    assert.equal(clampHours(500), MAX_HOURS);
  });
  it('normalise WelliIDs', () => {
    assert.equal(normaliseWrId(' wr-ab c123 '), 'WR-ABC123');
  });
});
