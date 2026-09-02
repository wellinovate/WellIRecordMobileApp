import { apiClient } from './apiClient';
import * as FileSystem from 'expo-file-system';

export interface OcrResult {
  success: boolean;
  title: string;
  provider: string;
  summary: string;
  keyValues: Array<{ label: string; value: string }>;
  rawText?: string;
  message?: string;
}

export const ocrService = {
  async extractFromImage(imageUri: string, recordType: string): Promise<OcrResult> {
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return apiClient.post<OcrResult>('/records/ocr-extract', {
      imageBase64,
      recordType,
    });
  },
};
