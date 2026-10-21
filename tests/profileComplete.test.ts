import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasEmergencyContact } from '../src/utils/profileComplete';

test('no member or an empty one has no emergency contact', () => {
  assert.equal(hasEmergencyContact(null), false);
  assert.equal(hasEmergencyContact({}), false);
  assert.equal(hasEmergencyContact({ contact: '   ', emergencyContacts: [] }), false);
  assert.equal(hasEmergencyContact({ emergencyContacts: [{ name: ' ', phone: '' }] }), false);
});

test('a formatted contact, a list entry or an object counts', () => {
  assert.equal(hasEmergencyContact({ contact: 'Ada (Sister) · 0803' }), true);
  assert.equal(hasEmergencyContact({ emergencyContacts: [{ name: 'Ada' }] }), true);
  assert.equal(hasEmergencyContact({ emergencyContacts: [{ phone: '0803' }] }), true);
  assert.equal(hasEmergencyContact({ emergencyContacts: ['Ada 0803'] }), true);
  assert.equal(hasEmergencyContact({ emergencyContact: { fullName: 'Ada' } }), true);
  assert.equal(hasEmergencyContact({ emergencyContact: 'Ada' }), true);
});
