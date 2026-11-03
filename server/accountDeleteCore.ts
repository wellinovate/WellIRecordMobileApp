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
