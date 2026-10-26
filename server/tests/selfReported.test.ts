import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createSelfReported } from '../selfReported';

async function withApp(userId: string | null, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createSelfReported({ getAuthUserId: () => userId, canAccess: async () => true, limiter: (_q, _s, n) => n() }).router);
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`); } finally { server.close(); }
}

test('every route needs a signed-in person', async () => {
  await withApp(null, async (base) => {
    for (const [m, p] of [['POST', '/health/measurements'], ['GET', '/health/measurements'], ['POST', '/health/medications'], ['GET', '/health/medications'], ['POST', '/health/family-history'], ['GET', '/health/family-history'], ['GET', '/health/family-history/options']] as const) {
      const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: m === 'POST' ? '{}' : undefined });
      assert.equal(r.status, 401, `${m} ${p}`);
    }
  });
});

test('writes and reads return 503 while the database is down, never a crash', async () => {
  await withApp('u1', async (base) => {
    const r = await fetch(base + '/health/measurements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ measurements: [{ kind: 'waist', value: 80 }] }) });
    assert.equal(r.status, 503);
  });
});

test('the options list gives relatives and conditions', async () => {
  await withApp('u1', async (base) => {
    const j: any = await (await fetch(base + '/health/family-history/options')).json();
    assert.ok(j.relatives.includes('Mother'));
    assert.ok(j.conditions.includes('Sickle cell disorder'));
  });
});
