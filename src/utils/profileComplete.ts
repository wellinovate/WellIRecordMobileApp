/**
 * The home screen asks for an emergency contact until one is saved.
 * Accepts the member shapes the app builds: a formatted `contact` string,
 * an `emergencyContacts` array, or an `emergencyContact` string or object.
 */
const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export function hasEmergencyContact(member: any): boolean {
  if (!member) return false;
  if (hasText(member.contact)) return true;
  if (hasText(member.emergencyContact)) return true;
  const ec = member.emergencyContact;
  if (ec && typeof ec === 'object' && (hasText(ec.name) || hasText(ec.fullName) || hasText(ec.phone) || hasText(ec.phoneNumber))) return true;
  const list = member.emergencyContacts;
  if (Array.isArray(list)) {
    return list.some((c) =>
      typeof c === 'string'
        ? hasText(c)
        : c && (hasText(c.name) || hasText(c.fullName) || hasText(c.phone) || hasText(c.phoneNumber)),
    );
  }
  return false;
}
