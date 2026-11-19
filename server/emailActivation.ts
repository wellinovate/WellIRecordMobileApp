// Database store and web page for the sign-up activation link. Rules are in emailActivationCore.ts.
import mongoose, { Schema } from 'mongoose';
import type { Request, Response } from 'express';
import { createActivationService, memoryActivationStore, type ActivationDoc, type ActivationStore } from './emailActivationCore';

const schema = new Schema(
  {
    emailHash: { type: String, required: true, index: true },
    attemptHash: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    createdAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true },
    activatedAt: { type: Number },
    // Mongo removes the row some time after this date.
    purgeAt: { type: Date, required: true, expires: 0 },
  },
  { collection: 'email_activations' },
);
const Model: mongoose.Model<any> = (mongoose.models.EmailActivation as mongoose.Model<any>) || mongoose.model('EmailActivation', schema);

const toDoc = (r: any) => (r ? { ...(r as ActivationDoc), id: String(r._id) } : null);

const mongoStore: ActivationStore = {
  async insert(doc) { await Model.create({ ...doc, purgeAt: new Date(doc.expiresAt + 60 * 60 * 1000) }); },
  async removeFor(e, a) { await Model.deleteMany({ emailHash: e, attemptHash: a }); },
  async findByToken(t) { return toDoc(await Model.findOne({ tokenHash: t }).lean()); },
  async findByAttempt(e, a) { return toDoc(await Model.findOne({ emailHash: e, attemptHash: a }).sort({ createdAt: -1 }).lean()); },
  async markActivated(id, at) { await Model.updateOne({ _id: id }, { $set: { activatedAt: at } }); },
  async remove(id) { await Model.deleteOne({ _id: id }); },
};

// Uses MongoDB when connected, memory otherwise (tests and local work). The choice is made on each call.
const fallback = memoryActivationStore();
const pick = (): ActivationStore => (mongoose.connection.readyState === 1 ? mongoStore : fallback);
export const activation = createActivationService({
  insert: (d) => pick().insert(d),
  removeFor: (e, a) => pick().removeFor(e, a),
  findByToken: (t) => pick().findByToken(t),
  findByAttempt: (e, a) => pick().findByAttempt(e, a),
  markActivated: (i, at) => pick().markActivated(i, at),
  remove: (i) => pick().remove(i),
});

const page = (title: string, body: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0F172A;line-height:1.55;text-align:center}h1{font-size:22px;color:#041E42}button{background:#041E42;color:#fff;border:0;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:700;cursor:pointer}.muted{color:#64748B;font-size:14px}</style></head><body>${body}</body></html>`;

const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

/** Shows a button instead of activating on load, so a mail scanner that opens links cannot activate it. */
export function activationConfirmPage(req: Request, res: Response) {
  const token = typeof req.query.t === 'string' ? req.query.t : '';
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Cache-Control', 'no-store');
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).type('html').send(page('Link not valid', `<h1>This link is not valid</h1><p>Open WelliRecord and ask for a new activation email.</p>`));
  }
  res.type('html').send(
    page(
      'Activate your WelliRecord account',
      `<h1>Activate your WelliRecord account</h1>
<p>Tap the button to confirm your email address. Then go back to the WelliRecord app.</p>
<form method="POST" action="/activate-email"><input type="hidden" name="t" value="${token}"><button type="submit">Activate my account</button></form>
<p class="muted">If you did not create a WelliRecord account, ignore this email.</p>`,
    ),
  );
}

export async function activationConfirmSubmit(req: Request, res: Response) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Cache-Control', 'no-store');
  const result = await activation.confirm(req.body?.t);
  if (result === 'ok') {
    return res.type('html').send(page('Email confirmed', `<h1>Email confirmed</h1><p>Go back to the WelliRecord app. It continues by itself. If it does not, enter the 6-digit code from the email.</p>`));
  }
  const text = result === 'expired' ? 'This link has expired. Open WelliRecord and ask for a new activation email.' : 'This link is not valid. Open WelliRecord and ask for a new activation email.';
  return res.status(400).type('html').send(page('Link not valid', `<h1>${result === 'expired' ? 'This link has expired' : 'This link is not valid'}</h1><p>${text}</p>`));
}
