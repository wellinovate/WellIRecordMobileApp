// Which files can be stored with a health record, and how to tell what a file really is. No database.
// The type comes from the first bytes, never from the name the phone sends.

export const RECORD_FILE_MAX_BYTES = 6_000_000;
export const RECORD_FILES_PER_RECORD = 5;
/** Largest base64 text that can hold a file of the limit (a third bigger than the file). */
export const RECORD_FILE_MAX_B64 = Math.ceil((RECORD_FILE_MAX_BYTES * 4) / 3) + 8;

export interface DetectedFile {
  contentType: string;
  ext: string;
}

const startsWith = (b: Buffer, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1');
const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? '');

const ZIP_OFFICE: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const OLE_OFFICE: Record<string, string> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};
const TEXT_EXT: Record<string, string> = { txt: 'text/plain', csv: 'text/csv' };

function looksLikeText(b: Buffer): boolean {
  const sample = b.subarray(0, Math.min(b.length, 4096));
  if (sample.includes(0)) return false;
  // Reject bytes that no text file uses; keep tab, newline and carriage return.
  for (const v of sample) if (v < 9 || (v > 13 && v < 32)) return false;
  return true;
}

/** Returns the stored type, or null when the file is not an allowed kind. */
export function detectFile(bytes: Buffer, name: string): DetectedFile | null {
  if (!bytes.length) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: 'image/png', ext: 'png' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
  if (ascii(bytes, 4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)/.test(ascii(bytes, 8, 12))) return { contentType: 'image/heic', ext: 'heic' };
  if (ascii(bytes, 0, 5) === '%PDF-') return { contentType: 'application/pdf', ext: 'pdf' };
  const ext = extOf(name);
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && ZIP_OFFICE[ext]) return { contentType: ZIP_OFFICE[ext], ext };
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && OLE_OFFICE[ext]) return { contentType: OLE_OFFICE[ext], ext };
  if (ascii(bytes, 0, 5) === '{\\rtf') return { contentType: 'application/rtf', ext: 'rtf' };
  if (TEXT_EXT[ext] && looksLikeText(bytes)) return { contentType: TEXT_EXT[ext], ext };
  return null;
}

export const ALLOWED_LABEL = 'photos (JPG, PNG, WebP, HEIC), PDF, Word, Excel, PowerPoint, RTF, TXT or CSV';

/** A file name safe to store and show: no path, no control characters, at most 120 characters. */
export function safeFileName(raw: unknown, fallbackExt: string): string {
  const noControls = Array.from(String(raw ?? ''))
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('');
  const base = noControls
    .replace(/[\\/]+/g, ' ')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-120);
  return base || `document.${fallbackExt}`;
}

/** Content types a browser or app may show inline. Everything else is sent as a download. */
export const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
