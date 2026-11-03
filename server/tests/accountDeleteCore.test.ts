import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decideAccountDelete } from '../accountDeleteCore';

test('no signed-in user means 401', () => {
  for (const v of [null, undefined, '', 'me', 'not-an-id', '123']) {
    const d = decideAccountDelete(v as any);
    assert.equal(d.ok, false);
    assert.equal(d.status, 401);
  }
});

test('a signed-in user deletes only their own id', () => {
  const id = '64b7f0c2a1b2c3d4e5f60718';
  const d = decideAccountDelete(id);
  assert.equal(d.ok, true);
  assert.equal(d.userId, id);
});

// server.ts cannot be imported here (it starts the server), so check the route's source for the old fallbacks.
test('the delete route no longer picks an account from the request body', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.ts'), 'utf8');
  const start = src.indexOf("app.delete('/api/v1/auth/account'");
  assert.ok(start > 0, 'route not found');
  const end = src.indexOf('// 7b. Chatbot Assistant Endpoints', start);
  const route = src.slice(start, end > start ? end : start + 8000);
  assert.match(route, /decideAccountDelete\(getAuthUserId\(req\)\)/);
  assert.doesNotMatch(route, /req\.body/);
  assert.doesNotMatch(route, /findOne\(\{ email/);
});
