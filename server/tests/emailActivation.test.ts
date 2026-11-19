import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivationService, memoryActivationStore, ACTIVATION_TTL_MS } from '../emailActivationCore';

const ATTEMPT = 'a1b2c3d4e5f6g7h8i9j0';
const setup = () => {
  let t = 1_000_000;
  const store = memoryActivationStore();
  const svc = createActivationService(store, () => t);
  return { svc, store, advance: (ms: number) => { t += ms; } };
};

test('a link needs a well-formed attempt id', async () => {
  const { svc } = setup();
  assert.equal(await svc.issue('a@b.com', undefined), null);
  assert.equal(await svc.issue('a@b.com', 'short'), null);
  assert.equal(await svc.issue('a@b.com', 'has spaces and symbols !!!!'), null);
  assert.match((await svc.issue('a@b.com', ATTEMPT)) || '', /^[a-f0-9]{64}$/);
});

test('tapping the link activates; only the same email and attempt see it', async () => {
  const { svc } = setup();
  const token = (await svc.issue('A@B.com ', ATTEMPT))!;
  assert.equal(await svc.isActivated('a@b.com', ATTEMPT), false);
  assert.equal(await svc.confirm(token), 'ok');
  assert.equal(await svc.isActivated('a@b.com', ATTEMPT), true);
  assert.equal(await svc.isActivated('other@b.com', ATTEMPT), false);
  assert.equal(await svc.isActivated('a@b.com', 'zzzzzzzzzzzzzzzzzzzz'), false);
});

test('a wrong or malformed token is invalid', async () => {
  const { svc } = setup();
  await svc.issue('a@b.com', ATTEMPT);
  assert.equal(await svc.confirm('f'.repeat(64)), 'invalid');
  assert.equal(await svc.confirm('nope'), 'invalid');
  assert.equal(await svc.confirm(undefined), 'invalid');
});

test('an expired link cannot activate or be used', async () => {
  const { svc, advance } = setup();
  const token = (await svc.issue('a@b.com', ATTEMPT))!;
  advance(ACTIVATION_TTL_MS + 1);
  assert.equal(await svc.confirm(token), 'expired');
  assert.equal(await svc.consume('a@b.com', ATTEMPT), false);
});

test('an activation expires if it is not used in time', async () => {
  const { svc, advance } = setup();
  const token = (await svc.issue('a@b.com', ATTEMPT))!;
  await svc.confirm(token);
  advance(ACTIVATION_TTL_MS + 1);
  assert.equal(await svc.isActivated('a@b.com', ATTEMPT), false);
});

test('the activation is used once, in place of the code', async () => {
  const { svc } = setup();
  const token = (await svc.issue('a@b.com', ATTEMPT))!;
  assert.equal(await svc.consume('a@b.com', ATTEMPT), false); // not tapped yet
  await svc.confirm(token);
  assert.equal(await svc.consume('a@b.com', ATTEMPT), true);
  assert.equal(await svc.consume('a@b.com', ATTEMPT), false); // gone
});

test('a resend replaces the earlier link', async () => {
  const { svc, store } = setup();
  const first = (await svc.issue('a@b.com', ATTEMPT))!;
  const second = (await svc.issue('a@b.com', ATTEMPT))!;
  assert.equal(store.size(), 1);
  assert.equal(await svc.confirm(first), 'invalid');
  assert.equal(await svc.confirm(second), 'ok');
});
