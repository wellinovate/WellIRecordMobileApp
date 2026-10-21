// Links this app's account to the same person's website account, so website visits and hospital
// record links can be handled in the app. The website makes a one-time code; the person enters it here.
// Calls to the website go through the signed bridge (bridgeSignature.ts). Nothing is shared until
// both sides have done their part.
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { WebLink } from './models';
import { bridgeConfigured, callMain, type BridgeResult } from './bridgeSignature';

export type CallMain = (method: 'GET' | 'POST' | 'DELETE' | 'PUT', path: string, body?: unknown) => Promise<BridgeResult>;

export interface WebLinkDeps {
  getAuthUserId: (req: Request) => string | null;
  limiter: RequestHandler;
  call?: CallMain;
}

export const CODE_RE = /^[A-Z2-9]{8}$/;
/** Same cleaning as the website: upper case, letters and digits only. */
export const cleanCode = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const safeSegment = (v: unknown) => (/^[A-Za-z0-9_-]{6,64}$/.test(String(v)) ? String(v) : null);
const safeIp = (v: unknown) => String(v ?? '').replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);

/** What the app is told when the website answers with an error. */
export function relayError(r: BridgeResult): { status: number; body: { success: false; message: string; code?: string; opensAt?: unknown } } {
  const status = r.status === 0 ? 503 : r.status === 401 || r.status === 403 ? (r.code ? 403 : 502) : r.status >= 500 ? 502 : r.status;
  const message = r.status === 0 ? 'The website could not be reached. Try again in a moment.' : r.message || 'The website could not do that.';
  return { status, body: { success: false, message, ...(r.code ? { code: r.code } : {}), ...(r.opensAt ? { opensAt: r.opensAt } : {}) } };
}

export function createWebLink(deps: WebLinkDeps) {
  const call: CallMain = deps.call ?? ((m, p, b) => callMain(m, p, b));
  const router = Router();

  const me = (req: Request, res: Response): string | null => {
    const id = deps.getAuthUserId(req);
    if (!id) {
      res.status(401).json({ success: false, message: 'Sign in to continue.' });
      return null;
    }
    return id;
  };
  const guard = (res: Response): boolean => {
    if (!bridgeConfigured() && !deps.call) {
      res.status(503).json({ success: false, message: 'Linking your website account is not switched on yet.' });
      return false;
    }
    return true;
  };
  const send = (res: Response, r: BridgeResult) => {
    if (r.ok) return res.json({ success: true, data: r.data });
    const e = relayError(r);
    return res.status(e.status).json(e.body);
  };
  /** Runs `fn` for a linked person, or answers 404 NOT_LINKED. */
  const linked = async (req: Request, res: Response, fn: (accountId: string) => Promise<BridgeResult>) => {
    const id = me(req, res);
    if (!id || !guard(res)) return;
    const mid = safeSegment(id);
    const link = mid ? await WebLink.findOne({ accountId: mid }).lean() : null;
    if (!link) return res.status(404).json({ success: false, code: 'NOT_LINKED', message: 'Link your website account first.' });
    const r = await fn(mid!);
    // The website says the link is gone (unlinked there): forget it here too.
    if (!r.ok && r.code === 'NOT_LINKED') await WebLink.deleteOne({ accountId: mid! }).catch(() => {});
    return send(res, r);
  };

  router.get('/web-link', async (req, res) => {
    const id = me(req, res);
    if (!id) return;
    const link: any = await WebLink.findOne({ accountId: id }).lean().catch(() => null);
    res.json({ success: true, available: bridgeConfigured() || Boolean(deps.call), linked: Boolean(link), fullName: link?.fullName || '', linkedAt: link?.linkedAt || null });
  });

  router.post('/web-link/claim', deps.limiter, async (req, res) => {
    const id = me(req, res);
    if (!id || !guard(res)) return;
    const mid = safeSegment(id);
    const code = cleanCode(req.body?.code);
    if (!mid || !CODE_RE.test(code)) return res.status(400).json({ success: false, message: 'Enter the 8 character code from the website.' });
    if (await WebLink.exists({ accountId: mid })) return res.status(409).json({ success: false, message: 'Your account is already linked.' });
    const r = await call('POST', '/api/v1/bridge/link/claim', { code, mobileAccountId: mid });
    if (!r.ok) return send(res, r);
    const d: any = r.data;
    try {
      await WebLink.create({ accountId: mid, webAccountId: String(d.webAccountId), webProfileId: String(d.webProfileId), fullName: String(d.fullName || '') });
    } catch {
      // Could not save here: undo on the website so the two sides agree.
      await call('POST', '/api/v1/bridge/link/revoke', { mobileAccountId: mid }).catch(() => null);
      return res.status(500).json({ success: false, message: 'Could not save the link. Make a new code and try again.' });
    }
    res.json({ success: true, linked: true, fullName: String(d.fullName || '') });
  });

  router.delete('/web-link', async (req, res) => {
    const id = me(req, res);
    if (!id) return;
    const mid = safeSegment(id);
    if (!mid) return res.json({ success: true, linked: false });
    // Tell the website first. If it cannot be reached we still remove the link here, and say so.
    const r = bridgeConfigured() || deps.call ? await call('POST', '/api/v1/bridge/link/revoke', { mobileAccountId: mid }) : { ok: true, status: 200 };
    await WebLink.deleteOne({ accountId: mid });
    res.json({ success: true, linked: false, websiteNotified: r.ok });
  });

  // ---- website video visits (A) ----
  router.get('/web-link/appointments', async (req, res) => {
    await linked(req, res, (mid) => call('GET', `/api/v1/bridge/patients/${mid}/appointments`));
  });
  router.post('/web-link/appointments/:id/token', deps.limiter, async (req, res) => {
    const aid = safeSegment(req.params.id);
    if (!aid) return res.status(400).json({ success: false, message: 'Unknown visit.' });
    await linked(req, res, (mid) => call('POST', `/api/v1/bridge/patients/${mid}/appointments/${aid}/token`, {}));
  });

  // ---- hospital record links (C) ----
  const rl = (mid: string, rest = '') => `/api/v1/bridge/patients/${mid}/record-links${rest}`;
  const tokenOk = (v: unknown) => (/^[A-Za-z0-9_-]{16,64}$/.test(String(v)) ? String(v) : null);
  router.get('/web-link/record-links', async (req, res) => {
    await linked(req, res, (mid) => call('GET', rl(mid)));
  });
  router.get('/web-link/record-links/claim/:token', async (req, res) => {
    const t = tokenOk(req.params.token);
    if (!t) return res.status(400).json({ success: false, message: 'That link code is not valid.' });
    await linked(req, res, (mid) => call('GET', rl(mid, `/claim/${t}`)));
  });
  const claimStep = (step: 'otp' | 'verify' | 'consent') => async (req: Request, res: Response) => {
    const t = tokenOk(req.params.token);
    if (!t) return res.status(400).json({ success: false, message: 'That link code is not valid.' });
    const body: Record<string, unknown> = { ip: safeIp(req.ip) };
    if (step === 'verify') body.code = String(req.body?.code ?? '').replace(/\D/g, '').slice(0, 8);
    if (step === 'consent') {
      body.version = String(req.body?.version ?? '').slice(0, 40);
      body.scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.map((x: unknown) => String(x).slice(0, 40)).slice(0, 10) : [];
    }
    await linked(req, res, (mid) => call('POST', rl(mid, `/claim/${t}/${step}`), body));
  };
  router.post('/web-link/record-links/claim/:token/otp', deps.limiter, claimStep('otp'));
  router.post('/web-link/record-links/claim/:token/verify', deps.limiter, claimStep('verify'));
  router.post('/web-link/record-links/claim/:token/consent', deps.limiter, claimStep('consent'));
  router.post('/web-link/record-links/:id/withdraw', deps.limiter, async (req, res) => {
    const lid = safeSegment(req.params.id);
    if (!lid) return res.status(400).json({ success: false, message: 'Unknown link.' });
    await linked(req, res, (mid) => call('POST', rl(mid, `/${lid}/withdraw`), { ip: safeIp(req.ip) }));
  });

  return { router };
}

/** Called when an account is erased: forget the link here and tell the website. */
export async function eraseWebLinks(accountIds: string[], call: CallMain = (m, p, b) => callMain(m, p, b)): Promise<void> {
  const ids = accountIds.map(safeSegment).filter((x): x is string => Boolean(x));
  if (!ids.length) return;
  const rows: any[] = await WebLink.find({ accountId: { $in: ids } }).lean();
  await WebLink.deleteMany({ accountId: { $in: ids } });
  for (const r of rows) await call('POST', '/api/v1/bridge/link/revoke', { mobileAccountId: r.accountId }).catch(() => null);
}
