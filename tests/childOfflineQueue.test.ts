import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChildCache, createChildOfflineQueue, isNetworkError, MAX_ATTEMPTS, type KeyValueStore } from '../src/utils/childOfflineQueueCore';

class ApiError extends Error {
  name = 'ApiError';
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

function setup(behaviour: { vaccination?: (p: any) => Promise<unknown>; growth?: (p: any) => Promise<unknown> } = {}, token = true) {
  const store = memoryStore();
  const sent: any[] = [];
  const api = {
    addVaccination: async (id: string, p: any) => {
      if (behaviour.vaccination) await behaviour.vaccination(p);
      sent.push(['vax', id, p]);
    },
    addGrowth: async (id: string, p: any) => {
      if (behaviour.growth) await behaviour.growth(p);
      sent.push(['growth', id, p]);
    },
  };
  const queue = createChildOfflineQueue({ store, api, hasToken: () => token });
  return { store, sent, queue };
}

test('network failures are recognised, other failures are not', () => {
  for (const code of [0, 408, 502, 503, 504]) assert.equal(isNetworkError(new ApiError('x', code)), true, String(code));
  for (const code of [400, 401, 403, 404, 409, 422, 500]) assert.equal(isNetworkError(new ApiError('x', code)), false, String(code));
  assert.equal(isNetworkError(new Error('boom')), false);
  assert.equal(isNetworkError(null), false);
});

test('entries are stored, listed per child, and sent in order', async () => {
  const { queue, sent } = setup();
  await queue.addVaccination('c1', { vaccineCode: 'BCG-1', administeredDate: '2026-10-01' });
  await queue.addGrowth('c1', { measuredOn: '2026-10-02', weightKg: '3.2' });
  await queue.addGrowth('c2', { measuredOn: '2026-10-03' });
  assert.equal((await queue.list('c1')).length, 2);
  assert.equal((await queue.list()).length, 3);
  assert.equal(await queue.flush(), 3);
  assert.deepEqual(sent.map((s) => s[0]), ['vax', 'growth', 'growth']);
  assert.equal((await queue.list()).length, 0);
});

test('growth entries get a stable clientId so a retry cannot duplicate', async () => {
  const { queue, sent } = setup();
  const item = await queue.addGrowth('c1', { measuredOn: '2026-10-02' });
  assert.match(item.payload.clientId, /^g_[\w-]{8,}$/);
  await queue.flush();
  assert.equal(sent[0][2].clientId, item.payload.clientId);
});

test('a network error stops the flush and keeps everything for later', async () => {
  let online = false;
  const { queue, sent } = setup({
    vaccination: async () => {
      if (!online) throw new ApiError('offline', 0);
    },
  });
  await queue.addVaccination('c1', { vaccineCode: 'BCG-1' });
  await queue.addVaccination('c1', { vaccineCode: 'OPV-0' });
  assert.equal(await queue.flush(), 0);
  assert.equal((await queue.list()).length, 2);
  assert.equal((await queue.list())[0].attempts, 0, 'being offline is not a failed attempt');
  online = true;
  assert.equal(await queue.flush(), 2);
  assert.equal(sent.length, 2);
});

test('a 409 on a dose means it is already saved, so it is removed', async () => {
  const { queue } = setup({
    vaccination: async () => {
      throw new ApiError('already recorded', 409);
    },
  });
  await queue.addVaccination('c1', { vaccineCode: 'BCG-1' });
  assert.equal(await queue.flush(), 1);
  assert.equal((await queue.list()).length, 0);
});

test('a refused entry stays, blocked, with the reason, and is not retried', async () => {
  let calls = 0;
  const { queue } = setup({
    growth: async () => {
      calls += 1;
      throw new ApiError('Date is in the future', 400);
    },
  });
  await queue.addGrowth('c1', { measuredOn: '2999-01-01' });
  assert.equal(await queue.flush(), 0);
  const [item] = await queue.list();
  assert.equal(item.blockedReason, 'Date is in the future');
  await queue.flush();
  assert.equal(calls, 1);
  await queue.remove(item.id);
  assert.equal((await queue.list()).length, 0);
});

test('a server error is retried and blocked only after the maximum attempts', async () => {
  const { queue } = setup({
    growth: async () => {
      throw new ApiError('Internal error', 500);
    },
  });
  await queue.addGrowth('c1', { measuredOn: '2026-10-02' });
  for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
    await queue.flush();
    assert.equal((await queue.list())[0].blockedReason, undefined, `attempt ${i}`);
  }
  await queue.flush();
  assert.ok((await queue.list())[0].blockedReason);
});

test('nothing is sent without a signed-in token', async () => {
  const { queue, sent } = setup({}, false);
  await queue.addVaccination('c1', { vaccineCode: 'BCG-1' });
  assert.equal(await queue.flush(), 0);
  assert.equal(sent.length, 0);
  assert.equal((await queue.list()).length, 1);
});

test('two flushes at once do not send an entry twice', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { queue, sent } = setup({ vaccination: () => gate });
  await queue.addVaccination('c1', { vaccineCode: 'BCG-1' });
  const first = queue.flush();
  const second = await queue.flush();
  release();
  assert.equal(second, 0);
  assert.equal(await first, 1);
  assert.equal(sent.length, 1);
});

test('subscribers hear about changes and can unsubscribe', async () => {
  const { queue } = setup();
  let n = 0;
  const off = queue.subscribe(() => void (n += 1));
  await queue.addGrowth('c1', { measuredOn: '2026-10-02' });
  assert.equal(n, 1);
  off();
  await queue.addGrowth('c1', { measuredOn: '2026-10-03' });
  assert.equal(n, 1);
});

test('sign out clears the queue and every cached profile', async () => {
  const { queue, store } = setup();
  const cache = createChildCache<{ x: number }>(store);
  await cache.set('c1', { x: 1 });
  await cache.set('c2', { x: 2 });
  await queue.addGrowth('c1', { measuredOn: '2026-10-02' });
  assert.deepEqual(await cache.get('c1'), { x: 1 });
  await queue.clearAll();
  assert.equal(await cache.get('c1'), null);
  assert.equal(await cache.get('c2'), null);
  assert.equal((await queue.list()).length, 0);
  assert.equal(store.data.size, 0);
});

test('a corrupt queue value is treated as empty, not a crash', async () => {
  const { queue, store } = setup();
  store.data.set('welli_child_offline_queue', '{not json');
  assert.deepEqual(await queue.list(), []);
});
