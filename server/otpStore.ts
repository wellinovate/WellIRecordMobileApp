// One-time codes for sign-in, password reset, app unlock, contact change and consent.
//
// They used to live in a Map in server memory, so a restart, a deploy, a sleeping instance or a second instance lost the code
// and the person saw "Invalid or expired authorization code" for a code they had just received. They now live in MongoDB
// (collection otp_codes), so any instance can check any code. Codes and identifiers are stored as HMACs, never in the clear.
//
// The rules (expiry, attempts, how many recent codes stay valid) are in this file with no database so tests can run them.
import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
/** A resend does not cancel the code already on its way: the newest few stay valid, so a late SMS still works. */
export const KEEP_RECENT = 3;

export interface OtpDoc {
  keys: string[];
  codeHash: string;
  mode: 'login' | 'signup';
  attempts: number;
  createdAt: number;
  expiresAt: number;
}

export interface OtpStore {
  /** Active (not expired) codes for any of these keys, newest first. */
  find(keys: string[], now: number): Promise<(OtpDoc & { id: string })[]>;
  insert(doc: OtpDoc): Promise<void>;
  /** Add one to the wrong-guess count of these codes. */
  bump(ids: string[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

const secret = () => process.env.OTP_HASH_KEY || process.env.JWT_SECRET || 'dev-only-otp-key';
const h = (kind: string, v: string) => crypto.createHmac('sha256', secret()).update(`otp:${kind}:${v}`).digest('hex');
export const hashKey = (k: string) => h('key', k);
export const hashCode = (c: string) => h('code', c);
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createOtpService(store: OtpStore, now: () => number = Date.now) {
  return {
    /** Makes a new code for the identifier (and its aliases, such as the same phone written three ways). */
    async issue(identifier: string, mode: 'login' | 'signup' = 'signup', aliases: string[] = []): Promise<string> {
      const code = crypto.randomInt(100000, 1000000).toString();
      const keys = Array.from(new Set([identifier, ...aliases].filter(Boolean))).map(hashKey);
      const t = now();
      const active = await store.find(keys, t);
      const drop = active.slice(KEEP_RECENT - 1).map((d) => d.id);
      if (drop.length) await store.remove(drop);
      await store.insert({ keys, codeHash: hashCode(code), mode, attempts: 0, createdAt: t, expiresAt: t + OTP_TTL_MS });
      return code;
    },

    /** The mode of the newest active code for these keys, or undefined. */
    async modeFor(keys: string[]): Promise<'login' | 'signup' | undefined> {
      const active = await store.find(keys.filter(Boolean).map(hashKey), now());
      return active[0]?.mode;
    },

    /** True when the code matches an active code for any key. A right code is used up. Five wrong guesses use the codes up. */
    async verify(keys: string | string[], code: string): Promise<boolean> {
      const hashed = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(hashKey);
      if (!hashed.length) return false;
      const active = await store.find(hashed, now());
      if (!active.length) return false;
      const guess = hashCode(String(code ?? '').trim());
      if (active.some((d) => d.attempts >= MAX_OTP_ATTEMPTS)) {
        await store.remove(active.map((d) => d.id));
        return false;
      }
      if (active.some((d) => same(d.codeHash, guess))) {
        await store.remove(active.map((d) => d.id));
        return true;
      }
      await store.bump(active.map((d) => d.id));
      if (active.some((d) => d.attempts + 1 >= MAX_OTP_ATTEMPTS)) await store.remove(active.map((d) => d.id));
      return false;
    },

    async clear(keys: string | string[]): Promise<void> {
      const hashed = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(hashKey);
      const active = await store.find(hashed, 0);
      if (active.length) await store.remove(active.map((d) => d.id));
    },
  };
}

/** In-memory store: tests, and local work with no database. Not shared between instances. */
export function memoryOtpStore(): OtpStore & { size(): number } {
  let seq = 0;
  const rows = new Map<string, OtpDoc>();
  return {
    size: () => rows.size,
    async find(keys, t) {
      return [...rows.entries()]
        .filter(([, d]) => (t === 0 || d.expiresAt > t) && d.keys.some((k) => keys.includes(k)))
        .map(([id, d]) => ({ ...d, id }))
        .sort((a, b) => b.createdAt - a.createdAt || Number(b.id) - Number(a.id));
    },
    async insert(doc) { rows.set(String(++seq), { ...doc }); },
    async bump(ids) { for (const id of ids) { const d = rows.get(id); if (d) d.attempts += 1; } },
    async remove(ids) { for (const id of ids) rows.delete(id); },
  };
}

const OtpSchema = new Schema(
  {
    keys: { type: [String], index: true },
    codeHash: { type: String, required: true },
    mode: { type: String, default: 'signup' },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true },
    // Mongo removes the row some time after this date (its sweep runs about once a minute); expiry is also checked on every read.
    expireAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { collection: 'otp_codes', versionKey: false }
);
const OtpModel = ((mongoose.models.OtpCode ?? mongoose.model('OtpCode', OtpSchema)) as unknown) as mongoose.Model<any>;

export const mongoOtpStore: OtpStore = {
  async find(keys, t) {
    const rows = await OtpModel.find({ keys: { $in: keys }, ...(t === 0 ? {} : { expiresAt: { $gt: t } }) }).sort({ createdAt: -1 }).limit(20).lean();
    return rows.map((r: any) => ({ id: String(r._id), keys: r.keys, codeHash: r.codeHash, mode: r.mode, attempts: r.attempts, createdAt: r.createdAt, expiresAt: r.expiresAt }));
  },
  async insert(doc) { await OtpModel.create({ ...doc, expireAt: new Date(doc.expiresAt + 60_000) }); },
  async bump(ids) { await OtpModel.updateMany({ _id: { $in: ids } }, { $inc: { attempts: 1 } }); },
  async remove(ids) { await OtpModel.deleteMany({ _id: { $in: ids } }); },
};

/** Uses MongoDB when connected, memory otherwise (tests and local work). The choice is made on each call. */
const fallback = memoryOtpStore();
const pick = (): OtpStore => (mongoose.connection.readyState === 1 ? mongoOtpStore : fallback);
export const otp = createOtpService({
  find: (k, t) => pick().find(k, t),
  insert: (d) => pick().insert(d),
  bump: (i) => pick().bump(i),
  remove: (i) => pick().remove(i),
});
