import { REQUIRED_DOCS } from '../data/legalDocs';
import { storage } from './storage';

const STORAGE_NAME = 'wr.legalAccepted.v1';

export interface LegalPayload {
  acceptedAt: string;
  documents: { id: string; version: string }[];
}

/** Saves that the person accepted every required document at its current version, now. */
export async function saveAcceptance(): Promise<LegalPayload> {
  const payload: LegalPayload = {
    acceptedAt: new Date().toISOString(),
    documents: REQUIRED_DOCS.map((d) => ({ id: d.id, version: d.version })),
  };
  await storage.setItem(STORAGE_NAME, JSON.stringify(payload));
  return payload;
}

/** The saved acceptance, or null when none is saved or a document has a newer version. */
export async function currentAcceptance(): Promise<LegalPayload | null> {
  try {
    const raw = await storage.getItem(STORAGE_NAME);
    if (!raw) return null;
    const saved = JSON.parse(raw) as LegalPayload;
    const ok = REQUIRED_DOCS.every((d) => saved.documents?.some((x) => x.id === d.id && x.version === d.version));
    return ok && saved.acceptedAt ? saved : null;
  } catch {
    return null;
  }
}

export async function clearAcceptance(): Promise<void> {
  await storage.removeItem(STORAGE_NAME);
}
