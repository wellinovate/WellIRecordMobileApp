// Every apiClient call in the app must match a route on the server, method and path.
// This caught PATCH /profile/update hitting a POST-only route (404 on every profile save).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string, out: string[] = []) => {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === 'tests') continue;
    const p = join(dir, f);
    statSync(p).isDirectory() ? walk(p, out) : /\.tsx?$/.test(f) && out.push(p);
  }
  return out;
};

// Client calls with no server route today. Nothing in the screens calls these. Remove an entry when
// the server route is added or the dead call is deleted.
const KNOWN_UNROUTED = new Set([
  'POST /records',
  'DELETE /records/*',
  'DELETE /shares/grants/*',
  'GET /shares/audit-logs',
]);

test('app API calls match server routes', () => {
  const routes: { m: string; re: RegExp }[] = [];
  for (const f of walk('server')) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/g)) {
      for (const p of m[2].matchAll(/['"`]([^'"`]+)['"`]/g)) {
        const path = p[1].replace(/^\/api\/v1/, '');
        routes.push({ m: m[1].toUpperCase(), re: new RegExp('^' + path.replace(/:\w+/g, '[^/]+') + '$') });
      }
    }
  }
  assert.ok(routes.length > 100, 'server routes were not found');
  const bad: string[] = [];
  for (const f of walk('src')) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/apiClient\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*(['"`])([^'"`]+)\2/g)) {
      const path = m[3].split('?')[0].replace(/\$\{[^}]*\}/g, 'x');
      const method = m[1].toUpperCase();
      if (routes.some((r) => r.m === method && r.re.test(path))) continue;
      const label = `${method} ${m[3].split('?')[0].replace(/\$\{[^}]*\}/g, '*')}`;
      if (!KNOWN_UNROUTED.has(label)) bad.push(`${label} (${f})`);
    }
  }
  assert.deepEqual(bad, []);
});
