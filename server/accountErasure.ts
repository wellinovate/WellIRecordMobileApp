// Removes the child-related data that hangs off an account's family members.
// Account deletion used to delete the FamilyMember rows only, leaving vaccines, growth,
// milestones, guardians, the access log, clinic codes and reminders behind.
import {
  ChildAuditLog,
  ChildFacilityGrant,
  ChildGrowth,
  ChildGuardian,
  ChildMilestone,
  ChildScreening,
  ChildVaccination,
  FamilyMember,
  ReminderLog,
  ReminderPreference,
} from './models';

export interface ErasureResult {
  children: number;
}

/**
 * Call before the FamilyMember rows are deleted. `accountIds` are every id the person is known by
 * (as ObjectIds); the string forms are used where a collection stores the account id as text.
 */
export async function eraseChildData(accountIds: any[]): Promise<ErasureResult> {
  const asStrings = accountIds.map((i) => String(i));
  const members: any[] = await FamilyMember.find({ $or: [{ accountId: { $in: accountIds } }, { userId: { $in: accountIds } }] }, { _id: 1 }).lean();
  const childIds = members.map((m) => m._id);
  if (childIds.length) {
    await Promise.all([
      ChildVaccination.deleteMany({ memberId: { $in: childIds } }),
      ChildGrowth.deleteMany({ memberId: { $in: childIds } }),
      ChildMilestone.deleteMany({ childId: { $in: childIds } }),
      ChildScreening.deleteMany({ childId: { $in: childIds } }),
      ChildGuardian.deleteMany({ childId: { $in: childIds } }),
      ChildAuditLog.deleteMany({ childId: { $in: childIds } }),
      ChildFacilityGrant.deleteMany({ childId: { $in: childIds } }),
      ReminderPreference.deleteMany({ childId: { $in: childIds } }),
      ReminderLog.deleteMany({ childId: { $in: childIds } }),
    ]);
  }
  // This person as a helper on someone else's child: remove their access, keep the child's data.
  await Promise.all([
    ChildGuardian.deleteMany({ accountId: { $in: asStrings } }),
    ReminderPreference.deleteMany({ accountId: { $in: asStrings } }),
    ReminderLog.deleteMany({ accountId: { $in: asStrings } }),
  ]);
  return { children: childIds.length };
}

/**
 * Removes the sign-in identity held by Clerk (Google/Apple sign-in), looked up by email.
 * Needs CLERK_SECRET_KEY. Never throws: the local erasure has already happened, so a failure here is
 * reported to the caller instead. Returns 'skipped' when no key is set.
 */
export async function deleteClerkIdentity(
  email: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<'deleted' | 'none' | 'skipped' | 'failed'> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key || !email) return 'skipped';
  try {
    const headers = { Authorization: `Bearer ${key}` };
    const r = await fetchImpl(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, { headers });
    if (!r.ok) return 'failed';
    const users: any = await r.json();
    const list: any[] = Array.isArray(users) ? users : users?.data || [];
    if (!list.length) return 'none';
    for (const u of list) {
      const d = await fetchImpl(`https://api.clerk.com/v1/users/${encodeURIComponent(u.id)}`, { method: 'DELETE', headers });
      if (!d.ok && d.status !== 404) return 'failed';
    }
    return 'deleted';
  } catch {
    return 'failed';
  }
}
