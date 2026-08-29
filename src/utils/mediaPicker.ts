import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface PickedMediaResult {
  uri: string;
  name?: string;
  size?: number;
  type?: string;
}

export async function pickImageFromCamera(
  allowsEditing = true
): Promise<PickedMediaResult | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.fileName || 'camera-capture.jpg',
        size: asset.fileSize,
        type: asset.mimeType || 'image/jpeg',
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
    if (Platform.OS !== 'web') {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        size: asset.fileSize,
        type: asset.mimeType || 'image/jpeg',
      };
    }
    return null;
  } catch (err) {
    console.warn('Error launching image library:', err);
    return null;
  }
}

export async function pickDocument(): Promise<PickedMediaResult | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        type: asset.mimeType,
      };
    }
    return null;
  } catch (err) {
    console.warn('Error picking document:', err);
    return null;
  }
}
