// Startup check of the secrets and risky switches in the environment. It reports; it does not
// stop the server unless ENFORCE_SECRET_CHECKS=true, so a stricter rule cannot take the API down
// by surprise on a deploy. Values are never printed, only names and the rule that failed.

export interface SecretFinding {
  level: 'error' | 'warn';
  name: string;
  message: string;
}

const WEAK = new Set(['secret', 'changeme', 'change-me', 'password', 'jwt_secret', 'jwtsecret', 'test', 'dev', 'development', 'wellirecord', 'admin']);

const isTrue = (v: unknown) => String(v ?? '').toLowerCase() === 'true';

export function checkSecrets(env: Record<string, string | undefined> = process.env, production = env.NODE_ENV === 'production'): SecretFinding[] {
  const out: SecretFinding[] = [];
  const add = (level: SecretFinding['level'], name: string, message: string) => out.push({ level, name, message });
  const prodError = production ? 'error' : 'warn';

  const jwt = env.JWT_SECRET ?? '';
  if (!jwt) add('error', 'JWT_SECRET', 'Not set.');
  else {
    if (jwt.length < 32) add(prodError, 'JWT_SECRET', 'Shorter than 32 characters. Use 48 random bytes (see docs/security/secrets-policy.md).');
    if (WEAK.has(jwt.toLowerCase())) add('error', 'JWT_SECRET', 'Is a common word. Anyone can forge sign-in tokens with it.');
  }

  const admin = env.ADMIN_SECRET;
  if (admin) {
    if (admin.length < 24) add('warn', 'ADMIN_SECRET', 'Shorter than 24 characters.');
    if (admin === jwt) add('error', 'ADMIN_SECRET', 'Same value as JWT_SECRET. Use separate secrets.');
  }

  if (production) {
    if (!env.MONGODB_URI) add('error', 'MONGODB_URI', 'Not set. The server would use a local database.');
    else if (/127\.0\.0\.1|localhost/.test(env.MONGODB_URI)) add('error', 'MONGODB_URI', 'Points at localhost in production.');
    if (!env.TERMII_API_KEY || env.TERMII_API_KEY === 'TL_TEST_KEY') add('warn', 'TERMII_API_KEY', 'Missing or a test key. SMS will not be delivered.');
    if (!env.RESEND_API_KEY && !env.SENDGRID_API_KEY) add('warn', 'RESEND_API_KEY', 'No email provider key. Email codes will not be delivered.');
  }
  if (!env.MFA_SECRET_KEY) add('warn', 'MFA_SECRET_KEY', 'Not set. Patient authenticator secrets are sealed with JWT_SECRET, so rotating JWT_SECRET would lock MFA users out. Set it before anyone turns MFA on.');
  else if (env.MFA_SECRET_KEY.length < 32) add('warn', 'MFA_SECRET_KEY', 'Shorter than 32 characters.');
  if (!env.CLERK_SECRET_KEY) add('warn', 'CLERK_SECRET_KEY', 'Not set. Google and Apple sign-in are refused until it is.');

  if (env.REVIEWER_OTP) {
    if (env.REVIEWER_OTP.length < 8) add('warn', 'REVIEWER_OTP', 'Shorter than 8 characters, so the reviewer bypass stays off.');
    else add('warn', 'REVIEWER_OTP', 'The store-reviewer sign-in bypass is on. Remove it after review.');
  }
  if (isTrue(env.ALLOW_LEGACY_ADMIN_SECRET)) add('warn', 'ALLOW_LEGACY_ADMIN_SECRET', 'The shared admin secret works as a staff login. Turn it off.');
  if (isTrue(env.ALLOW_THIRD_PARTY_OCR)) add('warn', 'ALLOW_THIRD_PARTY_OCR', 'Photo scanning is on: photos go to Google Cloud Vision and the text to a model provider.');
  if (!env.TERMII_API_KEY || env.TERMII_API_KEY === 'TL_TEST_KEY') add('warn', 'TERMII_API_KEY', 'Not set. No SMS code is sent, and phone sign-in is refused with a plain message.');
  if (isTrue(env.ALLOW_FAKE_SMS)) add('warn', 'ALLOW_FAKE_SMS', 'SMS codes are pretended, not sent. Local work only.');
  if (isTrue(env.ALLOW_LIVE_PROVIDER_SHARE)) add('warn', 'ALLOW_LIVE_PROVIDER_SHARE', 'Unencrypted provider links are allowed.');
  if (String(env.STAFF_MFA_REQUIRED ?? 'true').toLowerCase() === 'false') add('warn', 'STAFF_MFA_REQUIRED', 'Staff sign in without a second step.');

  return out;
}

/** Logs findings and, only when ENFORCE_SECRET_CHECKS=true, throws on any error. */
export function reportSecrets(env: Record<string, string | undefined> = process.env, log: Pick<Console, 'warn' | 'error'> = console) {
  const findings = checkSecrets(env);
  for (const f of findings) (f.level === 'error' ? log.error : log.warn)(`[secrets] ${f.name}: ${f.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  if (errors.length && isTrue(env.ENFORCE_SECRET_CHECKS)) {
    throw new Error(`Refusing to start: ${errors.map((e) => e.name).join(', ')} failed the secrets check.`);
  }
  return findings;
}
