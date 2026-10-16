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

export const ocrService = {
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
