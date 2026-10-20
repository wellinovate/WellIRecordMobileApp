import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/withApiPinning.js');
const pin = (c: string) => `${c.repeat(43)}=`;

describe('API pinning plugin', () => {
  afterEach(() => { delete process.env.API_PINS; delete process.env.API_PIN_HOST; delete process.env.API_PIN_EXPIRY; });

  it('does nothing when no pins are set', () => {
    const cfg = { name: 'x' };
    assert.equal(plugin(cfg), cfg);
  });
  it('refuses a single pin, a malformed pin, a bad host and a bad date', () => {
    process.env.API_PINS = pin('a');
    assert.throws(() => plugin({}), /at least two/);
    process.env.API_PINS = `${pin('a')},not-a-pin`;
    assert.throws(() => plugin({}), /not a base64/);
    process.env.API_PINS = `${pin('a')},${pin('b')}`;
    process.env.API_PIN_HOST = 'bad host/';
    assert.throws(() => plugin({}), /host name/);
    process.env.API_PIN_HOST = 'api.example.com';
    process.env.API_PIN_EXPIRY = 'next year';
    assert.throws(() => plugin({}), /YYYY|2027/);
  });
  it('writes a pin set with an expiry', () => {
    const xml = plugin.buildXml('api.example.com', [pin('a'), pin('b')], '2027-10-01');
    assert.match(xml, /<pin-set expiration="2027-10-01">/);
    assert.equal((xml.match(/<pin digest="SHA-256">/g) || []).length, 2);
    assert.match(xml, /<domain includeSubdomains="false">api\.example\.com<\/domain>/);
  });
});
