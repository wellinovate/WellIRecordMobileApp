import { File as ExpoFile } from 'expo-file-system';

import { apiClient } from './apiClient';
import type { PickedMediaResult } from '../utils/mediaPicker';

export interface OcrResult {
  success: boolean;
  title: string;
  provider: string;
  summary: string;
  keyValues: Array<{ label: string; value: string }>;
  rawText?: string;
  message?: string;
}

async function resolveImageBase64(
  media: PickedMediaResult,
): Promise<string> {
  const capturedBase64 = media.base64?.trim();

  if (capturedBase64) {
    return capturedBase64;
  }

  try {
    const file = new ExpoFile(media.uri);
    const base64 = await file.base64();

    if (base64) {
      return base64;
    }
  } catch {
    // Fall through to the clearer user-facing error below.
  }

  throw new Error(
    'The selected image could not be read. Please choose the image again.',
  );
}

let availableCache: boolean | null = null;

export const ocrService = {
  /** True only when the server says photo scanning is on. Any error counts as off, so a photo is never sent by mistake. */
  async available(): Promise<boolean> {
    if (availableCache !== null) return availableCache;
    try {
      const r = await apiClient.get<{ available?: boolean }>('/records/ocr-status');
      availableCache = r?.available === true;
    } catch {
      return false;
    }
    return availableCache;
  },

  async extractFromImage(
    media: PickedMediaResult,
    recordType: string,
  ): Promise<OcrResult> {
    const imageBase64 = await resolveImageBase64(media);

    return apiClient.post<OcrResult>(
      '/records/ocr-extract',
      {
        imageBase64,
        recordType,
      },
    );
  },
};
