// Emergency: clears the second sign-in step for one staff account, for example when the only admin
// has lost their authenticator and recovery codes. Run on the server with the production env:
//   npx ts-node scripts/reset-staff-mfa.ts person@clinic.ng
// They set up a new authenticator at next sign-in. The reset is written to the staff action log.
import 'dotenv/config';
import mongoose from 'mongoose';
import { StaffActionLog, StaffUser } from '../models';

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) throw new Error('Usage: reset-staff-mfa.ts <email>');
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) throw new Error('Set MONGODB_URI');
  await mongoose.connect((process.env.MONGODB_URI || process.env.MONGO_URI) as string);
  const user: any = await StaffUser.findOne({ email });
  if (!user) throw new Error(`No staff account for ${email}`);
  user.mfaEnabled = false;
  user.mfaSecretEnc = undefined;
  user.mfaRecovery = [];
  user.mfaLastStep = -1;
  user.tokenVersion += 1;
  await user.save();
  await StaffActionLog.create({ staffId: String(user._id), staffName: user.name, role: user.role, action: 'staff_mfa_reset_by_script', legacy: true });
  console.log(`Second step cleared for ${email}.`);
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
