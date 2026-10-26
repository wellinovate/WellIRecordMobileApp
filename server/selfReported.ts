// Other measurements, medications and family history that a person enters themselves.
// Writes need `addRecords` on the profile, reads need `viewRecords` (guardians of a child follow their own permissions).
import express, { Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import {
  FAMILY_CONDITIONS, FREQUENCIES, MEASUREMENT_KINDS, MEASUREMENT_RULES, RELATIVES, checkFamilyHistory, checkMeasurement, checkMedication,
} from './selfReportedCore';
import { FamilyHistoryEntry, SelfMeasurement, SelfMedication } from './selfReportedModels';

export interface SelfReportedDeps {
  getAuthUserId: (req: Request) => string | null;
  canAccess: (authUserId: string, ownerId: string, perm: 'viewRecords' | 'addRecords') => Promise<boolean>;
  limiter: RequestHandler;
  now?: () => Date;
}

const MAX_ACTIVE_MEDICATIONS = 50;
const MAX_FAMILY_ENTRIES = 40;
const lagosToday = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10);

export function createSelfReported(deps: SelfReportedDeps) {
  const router = express.Router();
  const now = () => (deps.now ? deps.now() : new Date());
  const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
  const oops = (res: Response, req: Request, err: unknown) => {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Try again.' });
  };

  /** Resolves the signed-in person and the profile they are acting on, or sends the error. */
  async function scope(req: Request, res: Response, perm: 'viewRecords' | 'addRecords') {
    const me = deps.getAuthUserId(req);
    if (!me) { fail(res, 401, 'Authentication required'); return null; }
    if (mongoose.connection.readyState !== 1) { fail(res, 503, 'Not available right now. Try again shortly.'); return null; }
    const raw = String((req.method === 'GET' || req.method === 'DELETE' ? req.query.ownerId : req.body?.ownerId) ?? 'me');
    const ownerId = raw === 'me' ? me : raw;
    if (!(await deps.canAccess(me, ownerId, perm))) { fail(res, 403, 'You do not have access to this profile'); return null; }
    return { me, ownerId };
  }

  // ----- other measurements -----

  router.post('/health/measurements', deps.limiter, async (req, res) => {
    const s = await scope(req, res, 'addRecords');
    if (!s) return;
    try {
      const list: any[] = Array.isArray(req.body?.measurements) ? req.body.measurements : [];
      if (!list.length) return fail(res, 400, 'Enter at least one measurement');
      if (list.length > MEASUREMENT_KINDS.length) return fail(res, 400, 'Too many measurements');
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const m of list) {
        const r = checkMeasurement(m ?? {});
        if (r.ok === false) return res.status(400).json({ success: false, message: r.reason, kind: String(m?.kind ?? '') });
        if (seen.has(r.value.kind)) return fail(res, 400, 'Each measurement can only be sent once at a time');
        seen.add(r.value.kind);
        rows.push({ ...r.value, accountId: s.me, ownerId: s.ownerId, measuredAt: now() });
      }
      await SelfMeasurement.insertMany(rows);
      return res.status(201).json({ success: true, saved: rows.length });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  router.get('/health/measurements', async (req, res) => {
    const s = await scope(req, res, 'viewRecords');
    if (!s) return;
    try {
      const latest: Record<string, unknown> = {};
      for (const kind of MEASUREMENT_KINDS) {
        const row: any = await SelfMeasurement.findOne({ ownerId: s.ownerId, kind }).sort({ measuredAt: -1 }).lean();
        if (row) latest[kind] = { value: row.value, unit: row.unit, context: row.context ?? null, measuredAt: row.measuredAt };
      }
      return res.json({ success: true, latest, units: Object.fromEntries(MEASUREMENT_KINDS.map((k) => [k, { default: MEASUREMENT_RULES[k].defaultUnit, options: Object.keys(MEASUREMENT_RULES[k].units) }])) });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  // ----- medications -----

  const medDto = (m: any) => ({ id: String(m._id), name: m.name, dose: m.dose, frequency: m.frequency, time: m.time ?? null, startDate: m.startDate, endDate: m.endDate ?? null, notes: m.notes ?? null });

  router.post('/health/medications', deps.limiter, async (req, res) => {
    const s = await scope(req, res, 'addRecords');
    if (!s) return;
    try {
      const r = checkMedication(req.body ?? {}, lagosToday(now()));
      if (r.ok === false) return fail(res, 400, r.reason);
      if ((await SelfMedication.countDocuments({ ownerId: s.ownerId })) >= MAX_ACTIVE_MEDICATIONS) return fail(res, 409, 'You have reached the limit. Remove one you no longer take.');
      const doc: any = await SelfMedication.create({ ...r.value, accountId: s.me, ownerId: s.ownerId });
      return res.status(201).json({ success: true, medication: medDto(doc) });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  router.get('/health/medications', async (req, res) => {
    const s = await scope(req, res, 'viewRecords');
    if (!s) return;
    try {
      const rows: any[] = await SelfMedication.find({ ownerId: s.ownerId }).sort({ createdAt: -1 }).limit(MAX_ACTIVE_MEDICATIONS).lean();
      return res.json({ success: true, medications: rows.map(medDto), frequencies: FREQUENCIES });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  router.delete('/health/medications/:id', async (req, res) => {
    const s = await scope(req, res, 'addRecords');
    if (!s) return;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Not found');
      const done = await SelfMedication.deleteOne({ _id: req.params.id, ownerId: s.ownerId });
      return done.deletedCount ? res.json({ success: true }) : fail(res, 404, 'Not found');
    } catch (err) {
      return oops(res, req, err);
    }
  });

  // ----- family history -----

  const famDto = (f: any) => ({ id: String(f._id), relative: f.relative, conditions: f.conditions, otherText: f.otherText ?? null, ageAtDiagnosis: f.ageAtDiagnosis ?? null, living: f.living ?? null });

  router.get('/health/family-history/options', (req, res) => {
    if (!deps.getAuthUserId(req)) return fail(res, 401, 'Authentication required');
    return res.json({ success: true, relatives: RELATIVES, conditions: FAMILY_CONDITIONS });
  });

  router.post('/health/family-history', deps.limiter, async (req, res) => {
    const s = await scope(req, res, 'addRecords');
    if (!s) return;
    try {
      const r = checkFamilyHistory(req.body ?? {});
      if (r.ok === false) return fail(res, 400, r.reason);
      if ((await FamilyHistoryEntry.countDocuments({ ownerId: s.ownerId })) >= MAX_FAMILY_ENTRIES) return fail(res, 409, 'You have reached the limit of relatives.');
      const doc: any = await FamilyHistoryEntry.create({ ...r.value, accountId: s.me, ownerId: s.ownerId });
      return res.status(201).json({ success: true, entry: famDto(doc) });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  router.get('/health/family-history', async (req, res) => {
    const s = await scope(req, res, 'viewRecords');
    if (!s) return;
    try {
      const rows: any[] = await FamilyHistoryEntry.find({ ownerId: s.ownerId }).sort({ createdAt: -1 }).limit(MAX_FAMILY_ENTRIES).lean();
      return res.json({ success: true, entries: rows.map(famDto) });
    } catch (err) {
      return oops(res, req, err);
    }
  });

  router.delete('/health/family-history/:id', async (req, res) => {
    const s = await scope(req, res, 'addRecords');
    if (!s) return;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Not found');
      const done = await FamilyHistoryEntry.deleteOne({ _id: req.params.id, ownerId: s.ownerId });
      return done.deletedCount ? res.json({ success: true }) : fail(res, 404, 'Not found');
    } catch (err) {
      return oops(res, req, err);
    }
  });

  return { router };
}
