import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeDevice, maskIp } from '../accountAudit';

describe('account audit helpers', () => {
  it('masks the last part of an address', () => {
    assert.equal(maskIp('102.89.23.45'), '102.89.23.x');
    assert.equal(maskIp('::ffff:102.89.23.45'), '102.89.23.x');
    assert.equal(maskIp('2001:db8:85a3:8d3:1319:8a2e:370:7348'), '2001:db8:85a3:…');
    assert.equal(maskIp(undefined), '');
  });
  it('describes a device without keeping the whole user agent', () => {
    assert.equal(describeDevice('okhttp/4.12.0 Android 14'), 'WelliRecord app on Android');
    assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), 'Browser on Windows');
    assert.equal(describeDevice(''), '');
  });
});
