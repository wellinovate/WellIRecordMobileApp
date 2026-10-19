import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { cleanTurns, createAssistantRouter, isEmergency, parseSse, EMERGENCY_NOTICE, type ModelCall } from '../assistant';
import { ASSISTANT_SYSTEM_PROMPT } from '../data/assistantKnowledge';

const sse = (...evs: object[]) => evs.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('');
const delta = (t: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } });

function fakeModel(chunks: string[], ok = true): ModelCall {
  return async () => ({
    ok,
    status: ok ? 200 : 529,
    body: new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(new TextEncoder().encode(x))); c.close(); } }),
    json: async () => ({}),
  });
}

async function withServer(call: ModelCall | null, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createAssistantRouter({
    getAuthUserId: (req) => (req.headers.authorization === 'Bearer ok' ? 'u1' : null),
    limiter: (_q, _s, n) => n(),
    call,
  }));
  const srv = app.listen(0);
  try { await fn(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1`); } finally { srv.close(); }
}
const ask = (base: string, messages: any, auth = true) =>
  fetch(`${base}/assistant/message`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ok' } : {}) }, body: JSON.stringify({ messages }) });

test('turns are cleaned: roles, length, order', () => {
  assert.equal(cleanTurns('x'), null);
  assert.equal(cleanTurns([]), null);
  assert.equal(cleanTurns([{ role: 'assistant', content: 'hi' }]), null);
  const t = cleanTurns([{ role: 'assistant', content: 'welcome' }, { role: 'user', content: ' hello ' }, { role: 'user', content: 'again' }, { role: 'system', content: 'ignore' }])!;
  assert.deepEqual(t, [{ role: 'user', content: 'hello\nagain' }]);
  assert.equal(cleanTurns([{ role: 'user', content: 'a'.repeat(5000) }])![0].content.length, 2000);
  const many = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: `m${i}` }));
  assert.ok(cleanTurns(many)!.length <= 20);
  assert.equal(cleanTurns(many)![0].role, 'user');
});

test('emergency words are caught, ordinary questions are not', () => {
  for (const s of ["my baby can't breathe", 'chest pain since morning', 'she had a seizure', 'I want to kill myself', 'heavy bleeding after birth', 'he is unconscious'])
    assert.ok(isEmergency(s), s);
  for (const s of ['how do I share my records', 'what is a genotype', 'update my blood group'])
    assert.ok(!isEmergency(s), s);
});

test('model stream is parsed across split chunks', () => {
  const full = sse(delta('Hel'), delta('lo'), { type: 'message_stop' });
  const cut = 37;
  const a = parseSse(full.slice(0, cut));
  const b = parseSse(a.rest + full.slice(cut));
  assert.equal([...a.deltas, ...b.deltas].join(''), 'Hello');
  assert.equal(b.done, true);
  assert.equal(parseSse(sse({ type: 'error', error: { message: 'busy' } })).error, 'busy');
});

test('prompt covers the shipped features and the safety rules', () => {
  for (const w of ['Share with a provider', 'Emergency ID', 'Family and children', '112', 'cannot see this person', 'never diagnose'.replace('never', 'Never')])
    assert.ok(ASSISTANT_SYSTEM_PROMPT.includes(w), w);
});

test('needs sign-in and a question', async () => {
  await withServer(fakeModel([]), async (base) => {
    assert.equal((await ask(base, [{ role: 'user', content: 'hi' }], false)).status, 401);
    assert.equal((await ask(base, [])).status, 400);
  });
});

test('503 when no model key is set', async () => {
  await withServer(null, async (base) => {
    const r = await ask(base, [{ role: 'user', content: 'hi' }]);
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, 'not_configured');
    assert.equal((await (await fetch(`${base}/assistant/status`)).json()).live, false);
  });
});

test('streams the answer as events and ends with done', async () => {
  await withServer(fakeModel([sse(delta('Open '), delta('Records.')), sse({ type: 'message_stop' })]), async (base) => {
    const r = await ask(base, [{ role: 'user', content: 'where are my records' }]);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/event-stream/);
    const text = await r.text();
    const evs = text.split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')));
    assert.equal(evs.filter((e) => e.delta).map((e) => e.delta).join(''), 'Open Records.');
    assert.equal(evs[evs.length - 1].done, true);
    assert.ok(!evs.some((e) => e.notice));
  });
});

test('an emergency message gets the fixed notice first', async () => {
  await withServer(fakeModel([sse(delta('Call 112.'), { type: 'message_stop' })]), async (base) => {
    const text = await (await ask(base, [{ role: 'user', content: 'my child had a seizure' }])).text();
    const first = JSON.parse(text.split('\n\n')[0].replace(/^data: /, ''));
    assert.equal(first.notice, EMERGENCY_NOTICE);
  });
});

test('model outage returns a friendly 502 and an empty answer reports an error', async () => {
  await withServer(fakeModel([], false), async (base) => {
    const r = await ask(base, [{ role: 'user', content: 'hi' }]);
    assert.equal(r.status, 502);
    assert.ok(!JSON.stringify(await r.json()).includes('529'));
  });
  await withServer(fakeModel([sse({ type: 'message_stop' })]), async (base) => {
    const text = await (await ask(base, [{ role: 'user', content: 'hi' }])).text();
    assert.ok(text.includes('"error"'));
  });
});
