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

export const API_BASE_URL = 'https://wellirecordmobileapp.onrender.com';

export const CONFIG: AppConfig = {
  // Live backend API URL on Render
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || API_BASE_URL,
  
  // Set to false when connecting to a live backend
  demoMode: true,

  // Nigerian SMS Gateway Sender ID (registered on Termii / DND-compliant)
  termiiSenderId: 'WelliRecord',

  // Cryptographic Vault Standards
  encryptionAlgorithm: 'AES-256-GCM',

  defaultHmoProvider: 'Hygeia HMO',

  requestTimeoutMs: 12000,
};
