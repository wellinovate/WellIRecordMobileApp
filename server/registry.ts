// Where patients registered and live, who has had their identity checked, and the counts staff read.
// A WelliID names the region someone registered in. It never changes. Where they live now is a separate field.
import { Router, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { UserProfile } from './models';
import { REGIONS, resolveRegion } from './data/nigeriaRegions';
import { isWelliId } from './welliId';
import { cleanLgaText, lgasForRegion, mapLga, normalizeLga } from './lgaCore';
import { ACTIVE_DAYS, buildRegionRows, isIdentityMethod, IDENTITY_METHODS, RawGroup } from './registryCore';

export interface RegistryDeps {
  getAuthUserId: (req: Request) => string | null;
  requireStaff: (...roles: any[]) => RequestHandler;
  actorName: (req: Request, typed?: unknown) => string;
}

export function createRegistry(deps: RegistryDeps): Router {
  const router = Router();

  // The list the app and website pickers use. Public: it is not personal data.
  router.get('/regions', (_req, res) => {
    res.json({ success: true, regions: REGIONS.map((r) => ({ code: r.code, name: r.name })) });
  });

  // The LGAs we hold for a state. An empty list means the app asks for free text. Public: not personal data.
  router.get('/lgas', (req: Request, res: Response) => {
    const region = resolveRegion(req.query.state);
    if (!region) return res.status(400).json({ success: false, message: 'Choose a state from the list.' });
    return res.json({ success: true, state: region.name, lgas: lgasForRegion(region.code).map((l) => ({ code: l.code, name: l.name })) });
  });

  // Change where the person lives now. The WelliID and the region they registered in stay as they are.
  router.patch('/profile/residence', async (req: Request, res: Response) => {
    const uid = deps.getAuthUserId(req);
    if (!uid || !mongoose.isValidObjectId(uid)) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    const region = resolveRegion(req.body?.state);
    if (!region) return res.status(400).json({ success: false, message: 'Choose a state from the list.' });
    const lga = mapLga(region.code, req.body?.lga, req.body?.lgaCode);
    try {
      const p: any = await UserProfile.findOneAndUpdate(
        { accountId: new mongoose.Types.ObjectId(uid) },
        { $set: { residenceState: region.name, residenceLga: lga.lgaText, ...lga } },
        { new: true, projection: 'wrId registrationRegion registrationState residenceState residenceLga lgaText lgaCode lgaMappingStatus' }
      ).lean();
      if (!p) return res.status(404).json({ success: false, message: 'Profile not found.' });
      return res.json({
        success: true,
        wrId: p.wrId,
        registrationState: p.registrationState || '',
        residenceState: p.residenceState,
        residenceLga: p.residenceLga || '',
        lgaText: p.lgaText || '',
        lgaCode: p.lgaCode || '',
        lgaMappingStatus: p.lgaMappingStatus || 'unverified',
      });
    } catch (err) {
      console.error('[residence] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save. Try again.' });
    }
  });

  // Admin review queue: typed LGAs that matched nothing, grouped by state and text, most common first.
  router.get('/staff/lga/review', deps.requireStaff(), async (req: Request, res: Response) => {
    if (req.staff?.role !== 'admin') return res.status(403).json({ success: false, message: 'Only an admin can do this.' });
    try {
      const rows = await UserProfile.aggregate([
        { $match: { lgaMappingStatus: 'needs_review' } },
        { $group: { _id: { state: '$residenceState', text: { $toLower: '$lgaText' } }, count: { $sum: 1 }, example: { $first: '$lgaText' } } },
        { $sort: { count: -1 } },
        { $limit: 200 },
      ]);
      return res.json({ success: true, items: rows.map((r: any) => ({ state: r._id.state || '', lgaText: r.example, count: r.count })) });
    } catch (err) {
      console.error('[lga-review] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load. Try again.' });
    }
  });

  // Admin maps one typed text to a catalogue code. Every profile in that state with that text (ignoring case) becomes verified.
  router.post('/staff/lga/map', deps.requireStaff(), async (req: Request, res: Response) => {
    if (req.staff?.role !== 'admin') return res.status(403).json({ success: false, message: 'Only an admin can do this.' });
    const region = resolveRegion(req.body?.state);
    const code = String(req.body?.lgaCode ?? '');
    const text = cleanLgaText(req.body?.lgaText);
    if (!region || !text || !lgasForRegion(region.code).some((l) => l.code === code)) {
      return res.status(400).json({ success: false, message: 'Send a state, the typed text and a code from that state.' });
    }
    try {
      const candidates: any[] = await UserProfile.find({ residenceState: region.name, lgaMappingStatus: 'needs_review' }, '_id lgaText').lean();
      const ids = candidates.filter((c) => normalizeLga(c.lgaText) === normalizeLga(text)).map((c) => c._id);
      const r = await UserProfile.updateMany({ _id: { $in: ids } }, { $set: { lgaCode: code, lgaMappingStatus: 'verified' } });
      return res.json({ success: true, updated: r.modifiedCount ?? ids.length });
    } catch (err) {
      console.error('[lga-map] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save. Try again.' });
    }
  });

  // Counts by canonical LGA for one state. Reads the stored code, never the ID text.
  router.get('/staff/stats/lgas', deps.requireStaff(), async (req: Request, res: Response) => {
    if (req.staff?.role !== 'admin') return res.status(403).json({ success: false, message: 'Only an admin can do this.' });
    const region = resolveRegion(req.query.state);
    if (!region) return res.status(400).json({ success: false, message: 'Choose a state from the list.' });
    try {
      const rows = await UserProfile.aggregate([
        { $match: { residenceState: region.name } },
        { $group: { _id: { $ifNull: ['$lgaCode', ''] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      return res.json({ success: true, state: region.name, rows: rows.map((r: any) => ({ lgaCode: r._id, count: r.count })) });
    } catch (err) {
      console.error('[lga-stats] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load. Try again.' });
    }
  });

  // A records officer records that they checked a patient's identity document. The number on the document is not stored.
  router.post('/staff/patients/identity-verify', deps.requireStaff('records_officer'), async (req: Request, res: Response) => {
    const wrId = String(req.body?.wrId ?? '').trim().toUpperCase();
    if (!isWelliId(wrId)) return res.status(400).json({ success: false, message: 'Enter the patient WelliID.' });
    if (!isIdentityMethod(req.body?.method)) {
      return res.status(400).json({ success: false, message: `Method must be one of: ${IDENTITY_METHODS.join(', ')}.` });
    }
    try {
      const p: any = await UserProfile.findOneAndUpdate(
        { wrId },
        { $set: { identityVerifiedAt: new Date(), identityVerifiedBy: deps.actorName(req, req.body?.verifiedBy), identityVerifiedMethod: req.body.method } },
        { new: true, projection: 'wrId identityVerifiedAt identityVerifiedMethod' }
      ).lean();
      if (!p) return res.status(404).json({ success: false, message: 'No patient with that WelliID.' });
      return res.json({ success: true, wrId: p.wrId, identityVerifiedAt: p.identityVerifiedAt, method: p.identityVerifiedMethod });
    } catch (err) {
      console.error('[identity-verify] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save. Try again.' });
    }
  });

  // Counts by registration region. Admin only. Real counts from the database, nothing estimated.
  router.get('/staff/stats/registrations', deps.requireStaff(), async (req: Request, res: Response) => {
    if (req.staff?.role !== 'admin') return res.status(403).json({ success: false, message: 'Only an admin can see registration counts.' });
    try {
      const since = new Date(Date.now() - ACTIVE_DAYS * 86400_000);
      const base: any[] = [
        { $match: { wrId: { $type: 'string', $ne: '' } } },
        { $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: 'acct', pipeline: [{ $project: { isVerified: 1, isEmailVerified: 1, isPhoneVerified: 1 } }] } },
        { $lookup: { from: 'healthrecords', localField: 'accountId', foreignField: 'userId', as: 'rec', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }] } },
      ];
      const [groups, residing, last] = await Promise.all([
        UserProfile.aggregate([
          ...base,
          {
            $group: {
              _id: { $ifNull: ['$registrationRegion', null] },
              registered: { $sum: 1 },
              contactVerified: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$isEmailVerified', true] },
                        { $in: ['$authProvider', ['phone_otp', 'email_otp']] },
                        { $anyElementTrue: { $map: { input: '$acct', as: 'a', in: { $or: [{ $eq: ['$$a.isVerified', true] }, { $eq: ['$$a.isEmailVerified', true] }, { $eq: ['$$a.isPhoneVerified', true] }] } } } },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              identityVerified: { $sum: { $cond: [{ $ifNull: ['$identityVerifiedAt', false] }, 1, 0] } },
              active30: { $sum: { $cond: [{ $gte: ['$lastActiveAt', since] }, 1, 0] } },
              withRecord: { $sum: { $cond: [{ $gt: [{ $size: '$rec' }, 0] }, 1, 0] } },
            },
          },
        ]),
        UserProfile.aggregate([{ $match: { wrId: { $type: 'string', $ne: '' }, residenceState: { $type: 'string', $ne: '' } } }, { $group: { _id: '$residenceState', n: { $sum: 1 } } }]),
        UserProfile.countDocuments({ lastActiveAt: { $exists: true } }),
      ]);
      const residingByName: Record<string, number> = {};
      for (const r of residing as any[]) residingByName[String(r._id)] = r.n;
      const { rows, totals } = buildRegionRows(groups as RawGroup[], residingByName);
      return res.json({
        success: true,
        generatedAt: new Date().toISOString(),
        activeDays: ACTIVE_DAYS,
        // Activity is only counted since this feature shipped, so early numbers are low. Say so.
        activityTracked: last > 0,
        rows,
        totals,
        notTrackedHere: [
          'Hospital records linked through the website',
          'Participating hospitals, labs and pharmacies per region (organisation profiles have no state field)',
          'Consent-authorised record access across facilities',
        ],
      });
    } catch (err) {
      console.error('[registration stats] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load the counts.' });
    }
  });

  return router;
}
