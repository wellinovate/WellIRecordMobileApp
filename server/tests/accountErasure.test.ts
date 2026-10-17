import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { deleteClerkIdentity } from '../accountErasure';

const resp = (ok: boolean, body: any = {}, status = ok ? 200 : 500) => ({ ok, status, json: async () => body }) as any;

describe('Clerk identity removal', () => {
  afterEach(() => { delete process.env.CLERK_SECRET_KEY; });

  it('is skipped without a key or an email', async () => {
    assert.equal(await deleteClerkIdentity('a@b.ng', (async () => resp(true)) as any), 'skipped');
    process.env.CLERK_SECRET_KEY = 'sk_test';
    assert.equal(await deleteClerkIdentity(undefined, (async () => resp(true)) as any), 'skipped');
  });
  it('looks the person up by email and deletes each match', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const calls: string[] = [];
    const f: any = async (url: string, init?: any) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      return init?.method === 'DELETE' ? resp(true) : resp(true, [{ id: 'user_1' }, { id: 'user_2' }]);
    };
    assert.equal(await deleteClerkIdentity('a+b@c.ng', f), 'deleted');
    assert.deepEqual(calls, [
      'GET https://api.clerk.com/v1/users?email_address=a%2Bb%40c.ng',
      'DELETE https://api.clerk.com/v1/users/user_1',
      'DELETE https://api.clerk.com/v1/users/user_2',
    ]);
  });
  it('reports none, and failure, without throwing', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    assert.equal(await deleteClerkIdentity('a@b.ng', (async () => resp(true, [])) as any), 'none');
    assert.equal(await deleteClerkIdentity('a@b.ng', (async () => resp(false)) as any), 'failed');
    assert.equal(await deleteClerkIdentity('a@b.ng', (async () => { throw new Error('net'); }) as any), 'failed');
  });
});
