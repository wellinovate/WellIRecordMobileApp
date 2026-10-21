import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordLink } from '../src/utils/recordLink';

const T = 'abcdefghijklmnopqrstuvwxyz012345'; // 32 characters

test('a full link or a bare code gives the same address on the WelliRecord website', () => {
  const want = { token: T, url: `https://www.wellirecord.com/join/${T}` };
  assert.deepEqual(parseRecordLink(`https://www.wellirecord.com/join/${T}`), want);
  assert.deepEqual(parseRecordLink(`  https://wellirecord.com/join/${T}/ `), want);
  assert.deepEqual(parseRecordLink(T), want);
});

test('links to other sites, wrong paths or short codes are refused', () => {
  assert.equal(parseRecordLink(`https://evil.example/join/${T}`), null);
  assert.equal(parseRecordLink(`https://wellirecord.com.evil.example/join/${T}`), null);
  assert.equal(parseRecordLink(`http://www.wellirecord.com/join/${T}`), null);
  assert.equal(parseRecordLink(`https://www.wellirecord.com:8443/join/${T}`), null);
  assert.equal(parseRecordLink(`https://www.wellirecord.com/other/${T}`), null);
  assert.equal(parseRecordLink(`https://www.wellirecord.com/join/short`), null);
  assert.equal(parseRecordLink('abc'), null);
  assert.equal(parseRecordLink(''), null);
});
