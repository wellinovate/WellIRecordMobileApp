import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// The native probe lives in deviceIntegrity.ts; the logic here takes it as a parameter.
describe('device integrity', () => {
  it('reports a rooted phone', async () => {
    const { checkIntegrity } = await import('../src/utils/deviceIntegrityCore');
    assert.deepEqual(await checkIntegrity(async () => true), { compromised: true, unknown: false });
  });
  it('reports a clean phone', async () => {
    const { checkIntegrity } = await import('../src/utils/deviceIntegrityCore');
    assert.deepEqual(await checkIntegrity(async () => false), { compromised: false, unknown: false });
  });
  it('treats a failed check as no finding', async () => {
    const { checkIntegrity } = await import('../src/utils/deviceIntegrityCore');
    assert.deepEqual(await checkIntegrity(async () => { throw new Error('no native module'); }), { compromised: false, unknown: true });
  });
});
