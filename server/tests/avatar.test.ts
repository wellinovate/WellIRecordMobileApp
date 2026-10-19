import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAvatar, MAX_AVATAR_CHARS } from '../avatar';

test('avatar validation', () => {
  assert.equal(cleanAvatar(undefined), undefined);
  assert.equal(cleanAvatar(''), '');
  assert.equal(cleanAvatar(null), '');
  assert.equal(cleanAvatar('data:image/jpeg;base64,/9j/4AAQ'), 'data:image/jpeg;base64,/9j/4AAQ');
  assert.equal(cleanAvatar('file:///data/user/0/photo.jpg'), null);
  assert.equal(cleanAvatar('data:text/html;base64,PHNjcmlwdD4='), null);
  assert.equal(cleanAvatar('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(cleanAvatar('data:image/jpeg;base64,' + 'A'.repeat(MAX_AVATAR_CHARS)), null);
  assert.equal(cleanAvatar(42), null);
});
