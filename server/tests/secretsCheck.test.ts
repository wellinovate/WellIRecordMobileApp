import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkSecrets, reportSecrets } from '../secretsCheck';

const good = { JWT_SECRET: 'x'.repeat(48), MFA_SECRET_KEY: 'y'.repeat(48), CLERK_SECRET_KEY: 'sk', MONGODB_URI: 'mongodb+srv://u:p@cluster/db', TERMII_API_KEY: 'k', RESEND_API_KEY: 'r' };
const names = (f: { name: string }[]) => f.map((x) => x.name);

describe('secrets check', () => {
  it('passes a clean production environment', () => {
    assert.deepEqual(checkSecrets({ ...good, NODE_ENV: 'production' }, true), []);
  });
  it('flags a short or common JWT secret', () => {
    assert.ok(names(checkSecrets({ ...good, JWT_SECRET: 'short' }, true)).includes('JWT_SECRET'));
    assert.equal(checkSecrets({ ...good, JWT_SECRET: 'password' }, false).some((f) => f.level === 'error'), true);
  });
  it('flags reuse of one value for two secrets', () => {
    assert.ok(checkSecrets({ ...good, ADMIN_SECRET: good.JWT_SECRET }, true).some((f) => f.name === 'ADMIN_SECRET' && f.level === 'error'));
  });
  it('flags a localhost database and test SMS key in production only', () => {
    const prod = checkSecrets({ ...good, MONGODB_URI: 'mongodb://127.0.0.1/x', TERMII_API_KEY: 'TL_TEST_KEY' }, true);
    assert.ok(names(prod).includes('MONGODB_URI') && names(prod).includes('TERMII_API_KEY'));
    assert.equal(names(checkSecrets({ ...good, MONGODB_URI: undefined, TERMII_API_KEY: undefined, RESEND_API_KEY: undefined }, false)).includes('MONGODB_URI'), false);
  });
  it('warns about risky switches', () => {
    const f = names(checkSecrets({ ...good, REVIEWER_OTP: '12345678', ALLOW_LEGACY_ADMIN_SECRET: 'true', ALLOW_LIVE_PROVIDER_SHARE: 'true', STAFF_MFA_REQUIRED: 'false' }, true));
    for (const n of ['REVIEWER_OTP', 'ALLOW_LEGACY_ADMIN_SECRET', 'ALLOW_LIVE_PROVIDER_SHARE', 'STAFF_MFA_REQUIRED']) assert.ok(f.includes(n), n);
  });
  it('never prints a secret value', () => {
    const lines: string[] = [];
    reportSecrets({ ...good, JWT_SECRET: 'password' }, { warn: (m: string) => lines.push(m), error: (m: string) => lines.push(m) } as any);
    assert.ok(lines.length > 0);
    assert.equal(lines.some((l) => l.includes('password') && !l.includes('common word')), false);
  });
  it('throws on errors only when enforcement is on', () => {
    const quiet = { warn: () => {}, error: () => {} } as any;
    assert.doesNotThrow(() => reportSecrets({ ...good, JWT_SECRET: 'password' }, quiet));
    assert.throws(() => reportSecrets({ ...good, JWT_SECRET: 'password', ENFORCE_SECRET_CHECKS: 'true' }, quiet));
  });
});
