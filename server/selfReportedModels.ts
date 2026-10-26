import mongoose, { Schema } from 'mongoose';

const reuse = (name: string, schema: Schema, collection: string) => ((mongoose.models[name] ?? mongoose.model(name, schema, collection)) as unknown) as mongoose.Model<any>;

// accountId is the signed-in account that entered the row; ownerId is whose record it belongs to ("me" is stored as the account id).
const SelfMeasurementSchema = new Schema(
  {
    accountId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    kind: { type: String, required: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    context: { type: String },
    measuredAt: { type: Date, default: Date.now },
    source: { type: String, default: 'self_reported' },
  },
  { timestamps: true }
);
SelfMeasurementSchema.index({ ownerId: 1, kind: 1, measuredAt: -1 });

const SelfMedicationSchema = new Schema(
  {
    accountId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    dose: { type: String, default: '' },
    frequency: { type: String, required: true },
    time: { type: String },
    startDate: { type: String, required: true },
    endDate: { type: String },
    notes: { type: String },
    source: { type: String, default: 'self_reported' },
  },
  { timestamps: true }
);

const FamilyHistorySchema = new Schema(
  {
    accountId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    relative: { type: String, required: true },
    conditions: { type: [String], default: [] },
    otherText: { type: String },
    ageAtDiagnosis: { type: Number },
    living: { type: Boolean },
    source: { type: String, default: 'self_reported' },
  },
  { timestamps: true }
);

export const SelfMeasurement = reuse('SelfMeasurement', SelfMeasurementSchema, 'sr_measurements');
export const SelfMedication = reuse('SelfMedication', SelfMedicationSchema, 'sr_medications');
export const FamilyHistoryEntry = reuse('FamilyHistoryEntry', FamilyHistorySchema, 'sr_family_history');

/** Removes everything entered by, or kept for, these accounts and their dependants. Call before the FamilyMember rows go. */
export async function eraseSelfReported(accountIds: unknown[], memberIds: unknown[]) {
  const accounts = accountIds.map(String);
  const owners = [...accounts, ...memberIds.map(String)];
  const q = { $or: [{ accountId: { $in: accounts } }, { ownerId: { $in: owners } }] };
  await Promise.all([SelfMeasurement.deleteMany(q), SelfMedication.deleteMany(q), FamilyHistoryEntry.deleteMany(q)]);
}
