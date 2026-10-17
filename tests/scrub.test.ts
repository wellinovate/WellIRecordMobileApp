import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrub } from '../src/utils/scrub';

test('emails, phone numbers, ids and tokens are masked', () => {
  const out = scrub('Failed for ada@example.com phone +234 803 123 4567 id 64b7f0c2a1b2c3d4e5f60718 token eyJhbGciOi.eyJzdWIi.sig_123');
  assert.doesNotMatch(out, /ada@example|803|64b7f0c2|eyJ/);
  assert.match(out, /\[email\]/);
  assert.match(out, /\[number\]/);
  assert.match(out, /\[id\]/);
  assert.match(out, /\[token\]/);
});

test('ordinary error text is left alone', () => {
  assert.equal(scrub('Cannot read properties of undefined (reading map)'), 'Cannot read properties of undefined (reading map)');
});
