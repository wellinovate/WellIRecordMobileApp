import { LEGAL_DOCS, REQUIRED_LEGAL, type LegalDocId } from './data/legalDocs';

export interface LegalInput {
  acceptedAt?: unknown;
  documents?: unknown;
}

export interface LegalCheck {
  ok: boolean;
  acceptedAt?: Date;
  documents: { id: LegalDocId; version: string }[];
}

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

/**
 * Checks what the app says the person accepted. Every required document must be listed with its
 * current version, and the time must be recent and not in the future. Nothing is guessed.
 */
export function checkLegal(input: LegalInput | undefined | null, now = new Date()): LegalCheck {
  const empty: LegalCheck = { ok: false, documents: [] };
  if (!input || typeof input !== 'object') return empty;
  const at = new Date(String(input.acceptedAt ?? ''));
  if (Number.isNaN(at.getTime())) return empty;
  const age = now.getTime() - at.getTime();
  if (age > MAX_AGE_MS || age < -MAX_FUTURE_MS) return empty;
  if (!Array.isArray(input.documents)) return empty;

  const seen = new Map<LegalDocId, string>();
  for (const d of input.documents as any[]) {
    const id = String(d?.id ?? '') as LegalDocId;
    if (!(id in LEGAL_DOCS)) continue;
    if (String(d?.version ?? '') !== LEGAL_DOCS[id].version) return empty;
    seen.set(id, LEGAL_DOCS[id].version);
  }
  for (const req of REQUIRED_LEGAL) if (!seen.has(req)) return empty;
  return { ok: true, acceptedAt: at, documents: [...seen].map(([id, version]) => ({ id, version })) };
}
