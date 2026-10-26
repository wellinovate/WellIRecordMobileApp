import test from 'node:test';
import assert from 'node:assert/strict';
import { thirdPartyOcrOn } from '../ocrPolicy';

test('third-party OCR is off unless explicitly turned on', () => {
  assert.equal(thirdPartyOcrOn({}), false);
  assert.equal(thirdPartyOcrOn({ ALLOW_THIRD_PARTY_OCR: '' }), false);
  assert.equal(thirdPartyOcrOn({ ALLOW_THIRD_PARTY_OCR: 'yes' }), false);
  assert.equal(thirdPartyOcrOn({ ALLOW_THIRD_PARTY_OCR: 'false' }), false);
  assert.equal(thirdPartyOcrOn({ ALLOW_THIRD_PARTY_OCR: 'true' }), true);
  assert.equal(thirdPartyOcrOn({ ALLOW_THIRD_PARTY_OCR: 'TRUE' }), true);
});
