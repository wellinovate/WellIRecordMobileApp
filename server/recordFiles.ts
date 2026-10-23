// Files attached to a health record: photos, PDF, Word, Excel, PowerPoint, RTF, text.
// The phone uploads a file first, then files the record with the returned ids. Files are sealed in our own database.
import { Router, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { RecordFile } from './models';
import { sealSecret, openSecret } from './totp';
import { ALLOWED_LABEL, detectFile, INLINE_TYPES, RECORD_FILE_MAX_B64, RECORD_FILE_MAX_BYTES, safeFileName } from './recordFilesCore';

export interface RecordFilesDeps {
  getAuthUserId: (req: Request) => string | null;
  canAccessOwner: (callerId: string, ownerId: string, perm?: string) => Promise<boolean>;
  sealKey: string;
  limiter: RequestHandler;
}

const oid = (v: unknown) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const MB = (RECORD_FILE_MAX_BYTES / 1_000_000).toFixed(0);

export function createRecordFiles(deps: RecordFilesDeps): Router {
  const router = Router();

  // Upload one file. Body: { name, dataBase64, ownerId? } ('me' or a family member id).
  router.post('/records/files', deps.limiter, async (req: Request, res: Response) => {
    const uid = deps.getAuthUserId(req);
    if (!uid) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    const rawOwner = String(req.body?.ownerId || 'me');
    const owner = rawOwner === 'me' ? uid : rawOwner;
    const ownerOid = oid(owner);
    if (!ownerOid) return res.status(400).json({ success: false, message: 'Unknown profile.' });
    const b64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64.replace(/^data:[^;]+;base64,/, '') : '';
    if (!b64 || b64.length > RECORD_FILE_MAX_B64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
      return res.status(400).json({ success: false, message: `Choose a file under ${MB} MB.` });
    }
    try {
      if (!(await deps.canAccessOwner(uid, owner, 'addRecords'))) {
        return res.status(403).json({ success: false, message: 'You cannot add records to this profile.' });
      }
      const bytes = Buffer.from(b64, 'base64');
      if (!bytes.length || bytes.length > RECORD_FILE_MAX_BYTES) {
        return res.status(400).json({ success: false, message: `Choose a file under ${MB} MB.` });
      }
      const kind = detectFile(bytes, String(req.body?.name ?? ''));
      if (!kind) {
        return res.status(415).json({ success: false, message: `That file type cannot be saved. Use ${ALLOWED_LABEL}.` });
      }
      const waiting = await RecordFile.countDocuments({ uploadedBy: new mongoose.Types.ObjectId(uid), recordId: { $exists: false } });
      if (waiting >= 12) {
        return res.status(429).json({ success: false, message: 'Too many files are waiting to be saved. Finish or cancel an upload and try again.' });
      }
      const name = safeFileName(req.body?.name, kind.ext);
      const doc = await RecordFile.create({
        uploadedBy: new mongoose.Types.ObjectId(uid),
        ownerId: ownerOid,
        name,
        contentType: kind.contentType,
        bytes: bytes.length,
        sealed: sealSecret(deps.sealKey, bytes.toString('base64')),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return res.status(201).json({ success: true, file: { id: String(doc._id), name, contentType: kind.contentType, bytes: bytes.length } });
    } catch (err) {
      console.error('[POST /records/files] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the file. Try again.' });
    }
  });

  // Download a file the caller may view. Sent as a download unless it is a photo or PDF.
  router.get('/records/files/:id', async (req: Request, res: Response) => {
    const uid = deps.getAuthUserId(req);
    if (!uid) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    const fid = oid(req.params.id);
    if (!fid) return res.status(404).json({ success: false, message: 'File not found.' });
    try {
      const f: any = await RecordFile.findById(fid).lean();
      const allowed = f && (String(f.uploadedBy) === uid || (await deps.canAccessOwner(uid, String(f.ownerId), 'viewRecords')));
      const data = allowed ? openSecret(deps.sealKey, f.sealed) : null;
      if (!f || !allowed || !data) return res.status(404).json({ success: false, message: 'File not found.' });
      const inline = INLINE_TYPES.has(f.contentType);
      res.set({
        'Content-Type': f.contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      });
      return res.send(Buffer.from(data, 'base64'));
    } catch (err) {
      console.error('[GET /records/files/:id] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load the file.' });
    }
  });

  return router;
}
