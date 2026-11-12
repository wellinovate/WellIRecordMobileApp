import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanNin, dobMatches, lagosDate, matchIdentity, namesMatch, profileComplete } from '../ninCore';
import { NinProviderError, lookupNin, ninConfig } from '../ninClient';
import { verifyNin, type NinDeps } from '../ninService';

const ENV = { TWOAM_API_KEY: 'nv_test_x', TWOAM_REQUEST_REASON: 'identity_verification' };
const profile = { fullName: 'Chinedu Okafor', dateOfBirth: new Date('1990-05-13T23:00:00Z') };
const record = { firstName: 'CHINEDU', lastName: 'Okafor', middleName: '', dateOfBirth: '1990-05-14', requestId: 'req_1' };

function makeDeps(over: Partial<NinDeps> = {}, state = { attempts: [] as string[], verified: false }): NinDeps & { state: typeof state } {
  return {
    state,
    getProfile: async () => profile,
    countAttempts: async () => state.attempts.filter((o) => ['verified', 'mismatch', 'not_found'].includes(o)).length,
    countAllAttempts: async () => state.attempts.length,
    recordAttempt: async (r) => { state.attempts.push(r.outcome); },
    markVerified: async () => { state.verified = true; },
    lookup: async () => record,
    ...over,
  };
}

test('cleanNin accepts 11 digits with spaces or dashes only', () => {
  assert.equal(cleanNin('123 4567-8901'), '12345678901');
  assert.equal(cleanNin('1234567890'), null);
  assert.equal(cleanNin('abcdefghijk'), null);
  assert.equal(cleanNin(null), null);
});

test('names match in any order, ignoring accents and case', () => {
  assert.ok(namesMatch({ fullName: 'Okafor Chinedu Emeka' }, record));
  assert.ok(namesMatch({ firstName: 'chínedu', lastName: 'OKAFOR' }, record));
  assert.ok(!namesMatch({ fullName: 'Chinedu Eze' }, record));
});

test('date of birth is compared on the Lagos calendar day, from a Date or text', () => {
  assert.equal(lagosDate(new Date('1990-05-13T23:00:00Z')), '1990-05-14');
  assert.equal(lagosDate('14/05/1990'), '1990-05-14');
  assert.equal(lagosDate('31/02/1990'), null);
  assert.ok(dobMatches('1990-05-14', '1990-05-14'));
  assert.ok(!dobMatches('1990-05-15', '1990-05-14'));
});

test('profile completeness needs two names and a date of birth, read from dob too', () => {
  assert.ok(profileComplete({ fullName: 'A B', dob: '1990-01-01' }));
  assert.ok(!profileComplete({ fullName: 'Single', dateOfBirth: '1990-01-01' }));
  assert.ok(!profileComplete({ fullName: 'A B' }));
  assert.ok(matchIdentity({ fullName: 'Chinedu Okafor', dob: '1990-05-14' }, record).ok);
});

test('lookup keeps only the comparison fields and maps provider errors', async () => {
  const ok = async () => new Response(JSON.stringify({ ...record, photo: 'BIGDATA', address: 'x', nin: '1' }), { status: 200 });
  const r = await lookupNin({ nin: '12345678901', env: ENV, fetchImpl: ok as any });
  assert.deepEqual(Object.keys(r).sort(), ['dateOfBirth', 'firstName', 'lastName', 'middleName', 'requestId']);
  const status = (n: number) => async () => new Response('{}', { status: n });
  for (const [n, code] of [[401, 'provider_auth'], [402, 'provider_balance'], [404, 'not_found'], [429, 'rate_limited'], [503, 'provider_down'], [400, 'bad_response']] as const) {
    await assert.rejects(lookupNin({ nin: '12345678901', env: ENV, fetchImpl: status(n) as any }), (e: any) => e instanceof NinProviderError && e.code === code);
  }
  await assert.rejects(lookupNin({ nin: '12345678901', env: {} }), (e: any) => e.code === 'not_configured');
  assert.equal(ninConfig({ TWOAM_API_KEY: 'k' }).enabled, false);
});

test('a match marks the profile verified', async () => {
  const d = makeDeps();
  const r = await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV });
  assert.equal(r.ok, true);
  assert.equal(d.state.verified, true);
  assert.deepEqual(d.state.attempts, ['verified']);
});

test('refuses without the feature, consent or a valid NIN, before any lookup', async () => {
  let called = 0;
  const d = makeDeps({ lookup: async () => { called++; return record; } });
  assert.equal((await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: {} })).code, 'not_available');
  assert.equal((await verifyNin({ accountId: 'a', nin: '12345678901', consent: false, deps: d, env: ENV })).code, 'consent_required');
  assert.equal((await verifyNin({ accountId: 'a', nin: '123', consent: true, deps: d, env: ENV })).code, 'invalid_nin');
  assert.equal(called, 0);
});

test('an incomplete profile is refused before a paid lookup', async () => {
  let called = 0;
  const d = makeDeps({ getProfile: async () => ({ fullName: 'Single' }), lookup: async () => { called++; return record; } });
  const r = await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV });
  assert.equal(r.code, 'profile_incomplete');
  assert.equal(called, 0);
});

test('an already verified profile does not look up again', async () => {
  let called = 0;
  const d = makeDeps({ getProfile: async () => ({ ...profile, identityVerifiedAt: new Date() }), lookup: async () => { called++; return record; } });
  const r = await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV });
  assert.equal(r.already, true);
  assert.equal(called, 0);
});

test('a mismatch gives a generic message and counts; three counted tries lock the day', async () => {
  const state = { attempts: [] as string[], verified: false };
  const d = makeDeps({ lookup: async () => ({ ...record, lastName: 'Eze' }) }, state);
  for (let i = 0; i < 3; i++) {
    const r = await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV });
    assert.equal(r.code, 'mismatch');
    assert.ok(!/Eze|Okafor/.test(r.message || ''));
  }
  assert.equal((await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV })).code, 'too_many_attempts');
  assert.equal(state.verified, false);
});

test('provider errors do not use up a try', async () => {
  const state = { attempts: [] as string[], verified: false };
  const d = makeDeps({ lookup: async () => { throw new NinProviderError('provider_down'); } }, state);
  for (let i = 0; i < 5; i++) assert.equal((await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV })).code, 'provider_error');
});

test('the daily cap switches the check off', async () => {
  const d = makeDeps({ countAllAttempts: async () => 200 });
  assert.equal((await verifyNin({ accountId: 'a', nin: '12345678901', consent: true, deps: d, env: ENV })).code, 'not_available');
});
