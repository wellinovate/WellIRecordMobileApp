import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clinicPage, ordersPage } from '../consolePages';

function render(handler: any) {
  const headers: Record<string, string> = {};
  let body = '';
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
    type: () => res,
    send: (b: string) => { body = b; },
  };
  handler({}, res);
  return { headers, body };
}

describe('staff pages', () => {
  for (const [name, h] of [['clinic', clinicPage], ['orders', ordersPage]] as const) {
    it(`${name}: signs in with a staff account, never the shared secret`, () => {
      const { body } = render(h);
      assert.ok(!/x-admin-secret/i.test(body));
      assert.ok(body.includes('/staff/auth/login') && body.includes('/staff/auth/mfa'));
      assert.ok(!body.includes('__AUTH__'));
    });
    it(`${name}: strict CSP with a fresh nonce on every script and style`, () => {
      const a = render(h);
      const b = render(h);
      const nonce = /nonce-([^']+)'/.exec(a.headers['content-security-policy'])![1];
      assert.notEqual(nonce, /nonce-([^']+)'/.exec(b.headers['content-security-policy'])![1]);
      assert.ok(a.headers['content-security-policy'].includes("default-src 'none'"));
      assert.ok(a.headers['content-security-policy'].includes("frame-ancestors 'none'"));
      assert.ok(a.body.includes(`<script nonce="${nonce}">`) && a.body.includes(`<style nonce="${nonce}">`));
      assert.ok(!/\sstyle="/.test(a.body) && !/\son[a-z]+="/.test(a.body), 'no inline style or handlers');
      assert.equal(a.headers['cache-control'], 'no-store');
    });
    it(`${name}: the script parses`, () => {
      const m = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(render(h).body)!;
      assert.doesNotThrow(() => new Function(m[1]));
    });
  }
  it('clinic page writes through the clinic endpoints', () => {
    const { body } = render(clinicPage);
    for (const p of ['/staff/users', '/staff/actions', '/reset-mfa', '/facility/child/lookup', '/facility/child/vaccinations', '/facility/child/growth']) assert.ok(body.includes(p), p);
  });
});
