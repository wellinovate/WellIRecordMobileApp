import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOtpService, memoryOtpStore, hashKey, MAX_OTP_ATTEMPTS, OTP_TTL_MS, KEEP_RECENT } from '../otpStore';

const setup = () => {
  let t = 1_000_000;
  const store = memoryOtpStore();
  const svc = createOtpService(store, () => t);
  return { svc, store, advance: (ms: number) => { t += ms; } };
};

describe('one-time codes', () => {
  it('a right code works once', async () => {
    const { svc } = setup();
    const c = await svc.issue('0907', 'login', ['+234907']);
    assert.equal(await svc.verify('0907', c), true);
    assert.equal(await svc.verify('0907', c), false);
  });
  it('the same phone written another way finds the code', async () => {
    const { svc } = setup();
    const c = await svc.issue('+2349070000407', 'signup', ['2349070000407', '09070000407']);
    assert.equal(await svc.verify(['09070000407', 'nothing'], c), true);
  });
  it('a wrong code fails, and five wrong guesses use the code up', async () => {
    const { svc } = setup();
    const c = await svc.issue('a@b.ng');
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) assert.equal(await svc.verify('a@b.ng', '000000'), false);
    assert.equal(await svc.verify('a@b.ng', c), false);
  });
  it('expires after five minutes', async () => {
    const { svc, advance } = setup();
    const c = await svc.issue('a@b.ng');
    advance(OTP_TTL_MS + 1);
    assert.equal(await svc.verify('a@b.ng', c), false);
  });
  it('a resend keeps the earlier code valid, so a late SMS still works', async () => {
    const { svc } = setup();
    const first = await svc.issue('0907');
    const second = await svc.issue('0907');
    assert.equal(await svc.verify('0907', first), true);
    // using one code uses them all up
    assert.equal(await svc.verify('0907', second), false);
  });
  it('only the newest few codes stay valid', async () => {
    const { svc } = setup();
    const codes: string[] = [];
    for (let i = 0; i < KEEP_RECENT + 2; i++) codes.push(await svc.issue('0907'));
    assert.equal(await svc.verify('0907', codes[0]), false);
  });
  it('codes for different people do not mix', async () => {
    const { svc } = setup();
    const a = await svc.issue('a@b.ng');
    await svc.issue('c@d.ng');
    assert.equal(await svc.verify('c@d.ng', a), false);
  });
  it('stores hashes, not codes or identifiers', async () => {
    const { svc, store } = setup();
    const c = await svc.issue('a@b.ng');
    const rows = await store.find([hashKey('a@b.ng')], 0);
    assert.equal(rows.length, 1);
    const json = JSON.stringify(rows);
    assert.ok(!json.includes(c) && !json.includes('a@b.ng'));
  });
  it('modeFor reports the newest mode; empty input is refused', async () => {
    const { svc } = setup();
    await svc.issue('x', 'login');
    assert.equal(await svc.modeFor(['x']), 'login');
    assert.equal(await svc.verify([], '123456'), false);
  });
  it('clear removes codes', async () => {
    const { svc } = setup();
    const c = await svc.issue('x');
    await svc.clear('x');
    assert.equal(await svc.verify('x', c), false);
  });
});
