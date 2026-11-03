// Who may erase an account. No database, so it can be tested on its own.
//
// Only the signed-in person can delete their own account. The id comes from the verified token and nowhere else:
// an email or phone number in the request body is never used to pick the account.

export interface DeleteDecision { ok: boolean; userId: string; status: number; message: string }

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function decideAccountDelete(authUserId: string | null | undefined): DeleteDecision {
  if (typeof authUserId !== 'string' || !OBJECT_ID.test(authUserId)) {
    return { ok: false, userId: '', status: 401, message: 'Sign in again to delete your account.' };
  }
  return { ok: true, userId: authUserId, status: 200, message: '' };
}

export interface PasswordCheck { ok: boolean; status: number; message: string }

/**
 * An account that has a password must give it before it is erased. An account with none (it signs in with a
 * code, Google or Apple) has nothing to check, and the signed-in token is the proof.
 * `compare` is bcrypt.compare in the route; it is passed in so this stays free of imports.
 */
export async function checkDeletePassword(
  storedHash: string | null | undefined,
  supplied: unknown,
  compare: (plain: string, hash: string) => Promise<boolean>,
): Promise<PasswordCheck> {
  if (!storedHash) return { ok: true, status: 200, message: '' };
  if (typeof supplied !== 'string' || supplied.length === 0 || supplied.length > 200) {
    return { ok: false, status: 403, message: 'Enter your password to delete your account.' };
  }
  let match = false;
  try { match = await compare(supplied, storedHash); } catch { match = false; }
  if (!match) return { ok: false, status: 403, message: 'That password is not correct.' };
  return { ok: true, status: 200, message: '' };
}
