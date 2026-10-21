import test from 'node:test';
import assert from 'node:assert/strict';
import { allergiesAnswered, allergyStatus, NO_KNOWN_ALLERGIES } from '../src/utils/allergyStatus';

test('listed allergies count as an answer', () => {
  assert.equal(allergyStatus('Penicillin, Shellfish'), 'recorded');
  assert.equal(allergyStatus(['Peanuts']), 'recorded');
  assert.equal(allergiesAnswered('Penicillin'), true);
});

test('saying there are none counts as an answer', () => {
  for (const v of [NO_KNOWN_ALLERGIES, 'none', 'None.', 'NKDA', 'nil', 'No allergies', 'no known drug allergies']) {
    assert.equal(allergyStatus(v), 'none', v);
    assert.equal(allergiesAnswered(v), true, v);
  }
});

test('empty or placeholder text is unanswered', () => {
  for (const v of [undefined, null, '', '  ', 'None on file', 'None recorded', 'Not recorded', 'unknown', 'None reported', []]) {
    assert.equal(allergyStatus(v), 'unknown', String(v));
    assert.equal(allergiesAnswered(v), false, String(v));
  }
});
