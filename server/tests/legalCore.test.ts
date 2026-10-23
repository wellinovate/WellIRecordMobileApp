import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkLegal } from '../legalCore';
import { LEGAL_DOCS } from '../data/legalDocs';

const now = new Date('2026-10-23T10:00:00Z');
const good = {
  acceptedAt: '2026-10-23T09:59:00Z',
  documents: [
    { id: 'privacy', version: LEGAL_DOCS.privacy.version },
    { id: 'terms', version: LEGAL_DOCS.terms.version },
  ],
};

describe('checkLegal', () => {
  it('accepts every required document at its current version', () => {
    const r = checkLegal(good, now);
    assert.equal(r.ok, true);
    assert.equal(r.documents.length, 2);
  });
  it('refuses missing input and a missing required document', () => {
    assert.equal(checkLegal(undefined, now).ok, false);
    assert.equal(checkLegal({ ...good, documents: [good.documents[0]] }, now).ok, false);
  });
  it('refuses an old version of a document', () => {
    assert.equal(checkLegal({ ...good, documents: [{ id: 'privacy', version: 'privacy-2020' }, good.documents[1]] }, now).ok, false);
  });
  it('refuses a stale or future time', () => {
    assert.equal(checkLegal({ ...good, acceptedAt: '2026-08-01T00:00:00Z' }, now).ok, false);
    assert.equal(checkLegal({ ...good, acceptedAt: '2026-10-24T00:00:00Z' }, now).ok, false);
    assert.equal(checkLegal({ ...good, acceptedAt: 'soon' }, now).ok, false);
  });
  it('ignores unknown documents', () => {
    assert.equal(checkLegal({ ...good, documents: [...good.documents, { id: 'other', version: 'x' }] }, now).ok, true);
  });
});
