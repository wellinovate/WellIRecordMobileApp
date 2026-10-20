// Prints fresh random values for the secrets WelliRecord uses. Nothing is saved or sent.
// Run:  npx ts-node scripts/generate-secrets.ts
// Then paste each value into Render (Environment) and redeploy. Do not paste them into chat or a ticket.
import crypto from 'crypto';

const make = (bytes: number) => crypto.randomBytes(bytes).toString('base64url');

const secrets: Record<string, string> = {
  JWT_SECRET: make(48),
  ADMIN_SECRET: make(32),
  MFA_SECRET_KEY: make(48),
};

console.log('# New secrets. Shown once. Copy straight into the host, then clear this terminal.\n');
for (const [name, value] of Object.entries(secrets)) console.log(`${name}=${value}`);
console.log('\n# Keys issued by other services (rotate in their dashboards, not here):');
console.log('# GEMINI_API_KEY, GOOGLE_PLACES_API_KEY, TERMII_API_KEY, RESEND_API_KEY, CLERK_SECRET_KEY, LIVEKIT_API_SECRET, MONGODB_URI password');
console.log('\n# Changing JWT_SECRET signs every patient out and ends open staff sessions. It also changes the key that');
console.log('# seals STAFF MFA secrets, so staff must be reset (npx ts-node scripts/reset-staff-mfa.ts <email>).');
console.log('# Patient MFA uses MFA_SECRET_KEY. Set it once, before anyone turns MFA on. Changing it later locks every');
console.log('# MFA user out of their second step.');
