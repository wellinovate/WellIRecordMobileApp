/**
 * WelliRecord Phone Normalization Utility
 * Normalizes Nigerian phone numbers to E.164 standard format (+234XXXXXXXXXX).
 * Accepts: 07030144923, +2347030144923, 2347030144923, 234 703 014 4923, etc.
 */
export function normalizeNigerianPhone(phone: string): string {
  if (!phone) return '';

  // Strip everything except digits and leading +
  const cleaned = phone.trim().replace(/[^\d+]/g, '');

  // Already in +234 format
  if (cleaned.startsWith('+234')) {
    return cleaned;
  }

  // 234XXXXXXXXXX (no +)
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+${cleaned}`;
  }

  // Local format: 0XXXXXXXXXX -> strip leading 0, prepend +234
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }

  // Bare 10-digit local number without leading 0 (e.g. 7030144923)
  if (cleaned.length === 10) {
    return `+234${cleaned}`;
  }

  // Fallback: return cleaned digits/string
  return cleaned;
}
