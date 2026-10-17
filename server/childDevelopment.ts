// Developmental milestones, screening visits and school summary logging.

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ChildMilestone, ChildScreening } from './models';
import { MILESTONE_CATALOGUE, MILESTONE_CODES } from './data/milestones';
import { auditChild, resolveChildAccess, type ChildAccess, type PermKey } from './childAccess';

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
};

export function createChildDevelopmentRouter(getAuthUserId: (req: Request) => string | null) {
  const router = express.Router();

  async function load(req: Request, res: Response, need: PermKey): Promise<ChildAccess | null> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    const a = await resolveChildAccess(actorId, req.params.id);
    if (!a) {
      res.status(404).json({ success: false, message: 'Family member not found' });
      return null;
    }
    if (!a.perms[need]) {
      res.status(403).json({ success: false, message: 'You do not have permission to do this' });
      return null;
    }
    return a;
  }
  const log = (a: ChildAccess, action: string, detail = '', dedupe = 0) => auditChild(a.member._id, a.actorId, a.role, action, detail, dedupe);

  router.get('/development/milestones', (_req, res) => res.json({ success: true, catalogue: MILESTONE_CATALOGUE }));

  router.get('/family/:id/development', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'viewRecords');
      if (!a) return;
      const [milestones, screenings] = await Promise.all([
        ChildMilestone.find({ childId: a.member._id }),
        ChildScreening.find({ childId: a.member._id }).sort({ date: -1 }),
      ]);
      return res.json({
        success: true,
        milestones: milestones.map((m: any) => ({ code: m.code, status: m.status, notes: m.notes || '' })),
        screenings: screenings.map((s: any) => ({ id: String(s._id), kind: s.kind, date: s.date, result: s.result, facility: s.facility || '', notes: s.notes || '' })),
      });
    } catch (err) {
      console.error('[GET development] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load development records' });
    }
  });

  // PUT /family/:id/milestones/:code { status, notes }
  router.put('/family/:id/milestones/:code', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'addRecords');
      if (!a) return;
      const code = req.params.code;
      const status = req.body?.status;
      if (!MILESTONE_CODES.has(code) || !['achieved', 'not_yet', 'unsure'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Choose a milestone and a status' });
      }
      const row: any = await ChildMilestone.findOneAndUpdate(
        { childId: a.member._id, code },
        { $set: { status, notes: text(req.body?.notes, 300), recordedBy: a.actorId, catalogueVersion: MILESTONE_CATALOGUE.version } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await log(a, 'milestone_recorded', `${code}: ${status}`);
      return res.json({ success: true, milestone: { code: row.code, status: row.status, notes: row.notes || '' } });
    } catch (err) {
      console.error('[PUT milestone] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the milestone' });
    }
  });

  router.delete('/family/:id/milestones/:code', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'addRecords');
      if (!a) return;
      await ChildMilestone.deleteOne({ childId: a.member._id, code: req.params.code });
      await log(a, 'milestone_cleared', req.params.code);
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE milestone] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not clear the milestone' });
    }
  });

  // POST /family/:id/screenings { kind, date, result, facility, notes }
  router.post('/family/:id/screenings', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'addRecords');
      if (!a) return;
      const b = req.body || {};
      const date = isoDate(b.date);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!date || date > tomorrow) return res.status(400).json({ success: false, message: 'Enter a valid date (YYYY-MM-DD) that is not in the future' });
      if (!['developmental', 'vision', 'hearing', 'dental'].includes(b.kind) || !['no_concerns', 'follow_up_advised', 'unsure'].includes(b.result)) {
        return res.status(400).json({ success: false, message: 'Choose the type and the result' });
      }
      const row: any = await ChildScreening.create({
        childId: a.member._id,
        kind: b.kind,
        date,
        result: b.result,
        facility: text(b.facility, 120),
        notes: text(b.notes, 300),
        recordedBy: a.actorId,
      });
      await log(a, 'screening_added', `${b.kind} ${date}`);
      return res.status(201).json({ success: true, screening: { id: String(row._id), kind: row.kind, date: row.date, result: row.result, facility: row.facility || '', notes: row.notes || '' } });
    } catch (err) {
      console.error('[POST screening] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the screening' });
    }
  });

  router.delete('/family/:id/screenings/:sid', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'addRecords');
      if (!a) return;
      if (!mongoose.isValidObjectId(req.params.sid)) return res.status(400).json({ success: false, message: 'Invalid record' });
      const removed = await ChildScreening.findOneAndDelete({ _id: req.params.sid, childId: a.member._id });
      if (!removed) return res.status(404).json({ success: false, message: 'Screening not found' });
      await log(a, 'screening_removed', `${removed.kind} ${removed.date}`);
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE screening] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not remove the screening' });
    }
  });

  // POST /family/:id/school/shared { items: string[] } — logs that the guardian handed a school summary to someone.
  router.post('/family/:id/school/shared', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res, 'viewRecords');
      if (!a) return;
      const items = Array.isArray(req.body?.items) ? req.body.items.filter((i: unknown) => typeof i === 'string').slice(0, 8).map((i: string) => i.slice(0, 40)) : [];
      await log(a, 'school_summary_shared', items.join(', ') || 'summary');
      return res.json({ success: true });
    } catch (err) {
      console.error('[POST school/shared] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not log this' });
    }
  });

  return router;
}
