// A profile photo is empty (remove it) or a data URL for a small jpeg, png or webp.
// Returns undefined when the field was not sent, '' to remove, null when invalid.
export const MAX_AVATAR_CHARS = 1_000_000;

export function cleanAvatar(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return '';
  if (typeof v !== 'string' || v.length > MAX_AVATAR_CHARS) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}
