/**
 * A hospital that holds a patient's records sends a link such as
 * https://www.wellirecord.com/join/<32 characters>. This reads the link (or the bare code)
 * and only accepts the WelliRecord website, so a pasted link to another site is never opened.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export const RECORD_LINK_BASE = 'https://www.wellirecord.com';
const HOSTS = new Set(['wellirecord.com', 'www.wellirecord.com']);

export function parseRecordLink(input: string): { token: string; url: string } | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (TOKEN_RE.test(raw)) return { token: raw, url: `${RECORD_LINK_BASE}/join/${raw}` };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname.toLowerCase()) || u.port) return null;
  const m = u.pathname.match(/^\/join\/([^/]+)\/?$/);
  if (!m || !TOKEN_RE.test(m[1])) return null;
  return { token: m[1], url: `${RECORD_LINK_BASE}/join/${m[1]}` };
}
