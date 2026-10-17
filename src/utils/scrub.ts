// Masks personal details in text before it is sent in an error report.

export function scrub(text: string): string {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b[0-9a-f]{24}\b/gi, '[id]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\bWR[-\s]?\w{4,}\b/gi, '[wellid]');
}
