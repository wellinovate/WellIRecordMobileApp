import mongoose, { Schema } from 'mongoose';

// One row per NIN check. It records the outcome and 2AM's request id for support. It never holds the NIN or any
// data from the NIN record. Rows expire after 90 days. Collection `ninattempts` is shared with the website backend.
const NinAttemptSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    outcome: { type: String, enum: ['verified', 'mismatch', 'not_found', 'provider_error'], required: true },
    requestId: { type: String, default: null },
    consentAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, index: { expires: 60 * 60 * 24 * 90 } },
  },
  { versionKey: false }
);

export const NinAttempt = ((mongoose.models.NinAttempt ?? mongoose.model('NinAttempt', NinAttemptSchema, 'ninattempts')) as unknown) as mongoose.Model<any>;

export async function eraseNinAttempts(accountIds: string[]) {
  const ids = accountIds.filter((i) => mongoose.isValidObjectId(i)).map((i) => new mongoose.Types.ObjectId(i));
  if (ids.length) await NinAttempt.deleteMany({ accountId: { $in: ids } });
}
