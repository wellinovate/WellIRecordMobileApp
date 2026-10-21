// Lets a provider who signed up on the website set up how it takes bookings in the app, and work its
// visits, without an admin doing it. The website backend checks who the caller is (the organisation's
// own login, an approved organisation) and calls these routes with a signed request (bridgeSignature.ts).
// This side re-checks that the facility is an approved registered organisation and never changes the
// admin-only fields: the payout account and which staff accounts are assigned.
import { Router, type Request, type Response } from 'express';
import { ProviderService } from './models';
import { requireBridge } from './bridgeSignature';
import { parseServiceFields } from './bookingCore';
import type { Outcome } from './clinicVisits';

export interface BridgeProvidersDeps {
  registeredIds: () => Promise<Set<string>>;
  listVisits: (mine: string[] | null) => Promise<any[]>;
  confirmVisit: (id: unknown, mine: string[] | null) => Promise<Outcome>;
  cancelVisit: (id: unknown, mine: string[] | null) => Promise<Outcome>;
  videoToken: (id: unknown, mine: string[] | null, who: { id: string; name: string }) => Promise<Outcome>;
  decideHmo: (a: { id: unknown; decision: unknown; approvalCode?: unknown; who: string; mine: string[] | null }) => Promise<Outcome>;
}

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
export const facilityIdOk = (v: unknown) => (/^[A-Za-z0-9_-]{3,80}$/.test(String(v)) ? String(v) : null);

/** What the website may see of a provider setup. The payout account and assigned staff stay on this side. */
export function publicService(svc: any) {
  if (!svc) return null;
  const { staffIds, paystackSubaccount, _id, __v, ...rest } = svc;
  return { ...rest, payoutReady: Boolean(paystackSubaccount) };
}

export function createBridgeProviders(deps: BridgeProvidersDeps) {
  const router = Router();
  router.use('/bridge/providers', requireBridge);

  const run = (fn: (req: Request, facilityId: string) => Promise<Outcome>) => async (req: Request, res: Response) => {
    const facilityId = facilityIdOk(req.params.facilityId);
    if (!facilityId) return res.status(400).json({ success: false, message: 'Unknown provider.' });
    try {
      if (!(await deps.registeredIds()).has(facilityId)) {
        return res.status(403).json({ success: false, code: 'NOT_APPROVED', message: 'This organisation is not approved on WelliRecord yet.' });
      }
      const r = await fn(req, facilityId);
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error('[bridge providers] ERROR:', err);
      res.status(500).json({ success: false, message: 'Something went wrong. Try again.' });
    }
  };

  router.get('/bridge/providers/:facilityId/service', run(async (_req, facilityId) => {
    const svc = await ProviderService.findOne({ facilityId }).lean();
    return { status: 200, body: { success: true, data: publicService(svc) } };
  }));

  router.put('/bridge/providers/:facilityId/service', run(async (req, facilityId) => {
    const b = req.body || {};
    const parsed = parseServiceFields(b);
    if ('error' in parsed) return { status: 400, body: { success: false, message: parsed.error } };
    const name = clip(b.facilityName, 120);
    if (!name) return { status: 400, body: { success: false, message: 'Provider name is required' } };
    const existing: any = await ProviderService.findOne({ facilityId }, 'paystackSubaccount').lean();
    const set: any = {
      ...parsed.set,
      // Money from an online payment goes to a payout account. Until support sets one up, online payment stays off.
      onlinePayment: parsed.set.onlinePayment === true && Boolean(existing?.paystackSubaccount),
      facilityName: name,
      facilityAddress: clip(b.facilityAddress, 200),
      specialty: clip(b.specialty, 80),
      updatedBy: clip(b.actor, 120) || 'provider',
    };
    const svc = await ProviderService.findOneAndUpdate({ facilityId }, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return { status: 200, body: { success: true, data: publicService(svc) } };
  }));

  router.get('/bridge/providers/:facilityId/visits', run(async (_req, facilityId) => ({ status: 200, body: { success: true, data: await deps.listVisits([facilityId]) } })));
  router.post('/bridge/providers/:facilityId/visits/:id/confirm', run((req, facilityId) => deps.confirmVisit(req.params.id, [facilityId])));
  router.post('/bridge/providers/:facilityId/visits/:id/cancel', run((req, facilityId) => deps.cancelVisit(req.params.id, [facilityId])));
  router.post('/bridge/providers/:facilityId/visits/:id/video-token', run((req, facilityId) =>
    deps.videoToken(req.params.id, [facilityId], { id: clip(req.body?.who?.id, 40) || 'web', name: clip(req.body?.who?.name, 80) || 'Clinician' })
  ));
  router.post('/bridge/providers/:facilityId/visits/:id/hmo', run((req, facilityId) =>
    deps.decideHmo({ id: req.params.id, decision: req.body?.decision, approvalCode: req.body?.approvalCode, who: clip(req.body?.decidedBy, 120) || 'provider', mine: [facilityId] })
  ));

  return { router };
}
