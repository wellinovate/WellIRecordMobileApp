import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountDeletionPage } from '../publicPages';

describe('account deletion page', () => {
  it('names the in-app path and an email route, with no script', () => {
    let body = '';
    const res: any = { setHeader() {}, type: () => res, send: (b: string) => { body = b; } };
    accountDeletionPage({} as any, res);
    assert.match(body, /Profile, then Privacy and security/);
    assert.match(body, /mailto:/);
    assert.ok(!/<script/i.test(body));
  });
});
