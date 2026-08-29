import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricStatus {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  biometryType: 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';
  label: string;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (Platform.OS === 'web') {
    return {
      isAvailable: false,
      hasHardware: false,
      isEnrolled: false,
      biometryType: 'face',
      label: 'Face ID',
    };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: BiometricStatus['biometryType'] = 'generic';
    let label = 'Biometrics';

    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      )
    ) {
      biometryType = 'face';
      label = Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT
      )
    ) {
      biometryType = 'fingerprint';
      label = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    } else if (
      supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
    ) {
      biometryType = 'iris';
      label = 'Iris Scan';
    }

    return {
      isAvailable: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      biometryType,
      label,
    };
  } catch {
    return {
      isAvailable: false,
      hasHardware: false,
      isEnrolled: false,
      biometryType: 'none',
      label: 'Biometrics',
    };
  }
}

export async function authenticateWithBiometrics(
  promptMessage = 'Unlock WelliRecord'
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    // On web prototype, simulate quick successful biometric unlock
    return { success: true };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }
    return {
      success: false,
      error: result.error || 'Authentication failed',
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Authentication failed';
    return { success: false, error: message };
  }
}
