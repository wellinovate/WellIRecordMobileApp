/**
 * WelliRecord Service Configuration
 * Provides environment toggles between Live Backend API and Offline/Demo Mode.
 */

export interface AppConfig {
  apiBaseUrl: string;
  demoMode: boolean;
  termiiSenderId: string;
  encryptionAlgorithm: string;
  defaultHmoProvider: string;
  requestTimeoutMs: number;
}

export const CONFIG: AppConfig = {
  // In production, update with your live backend API URL (e.g., https://api.wellirecord.com/v1)
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.wellirecord.com/v1',
  
  // Set to false when connecting to a live backend
  demoMode: true,

  // Nigerian SMS Gateway Sender ID (registered on Termii / DND-compliant)
  termiiSenderId: 'WelliRecord',

  // Cryptographic Vault Standards
  encryptionAlgorithm: 'AES-256-GCM',

  defaultHmoProvider: 'Hygeia HMO',

  requestTimeoutMs: 12000,
};
