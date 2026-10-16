import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface PickedMediaResult {
  uri: string;
  name?: string;
  size?: number;
  type?: string;
  base64?: string;
}

async function ensureMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  const { status } =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  return status === 'granted';
}

export async function pickImageFromCamera(
  allowsEditing = true
): Promise<PickedMediaResult | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } =
        await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];

      return {
        uri: asset.uri,
        name: asset.fileName || 'camera-capture.jpg',
        size: asset.fileSize,
        type: asset.mimeType || 'image/jpeg',
        base64: asset.base64 || undefined,
      };
    }

    return null;
  } catch (err) {
    console.warn('Error launching camera:', err);
    return null;
  }
}

export async function pickImageFromLibrary(
  allowsEditing = true
): Promise<PickedMediaResult | null> {
  try {
    const permitted = await ensureMediaLibraryPermission();

    if (!permitted) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];

      return {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        size: asset.fileSize,
        type: asset.mimeType || 'image/jpeg',
        base64: asset.base64 || undefined,
      };
    }

    return null;
  } catch (err) {
    console.warn('Error launching image library:', err);
    return null;
  }
}

/**
 * The OCR endpoint currently accepts imageBase64, not PDFs.
 * Keep the existing pickDocument() API for UploadModal, but use
 * ImagePicker so the image bytes are captured immediately and
 * do not depend on a temporary Android DocumentPicker URI.
 */
export async function pickDocument(): Promise<PickedMediaResult | null> {
  return pickImageFromLibrary(false);
}
