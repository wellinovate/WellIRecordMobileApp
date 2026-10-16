/**
 * WelliRecord Service Configuration
 * Service configuration for the live backend API.
 */

export interface AppConfig {
  apiBaseUrl: string;
  termiiSenderId: string;
  encryptionAlgorithm: string;
  defaultHmoProvider: string;
  requestTimeoutMs: number;
}

export const API_BASE_URL = 'https://wellirecordmobileapp.onrender.com/api/v1';

export const CONFIG: AppConfig = {
  // Live backend API URL on Render
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || API_BASE_URL,
  
  // Nigerian SMS Gateway Sender ID (registered on Termii / DND-compliant)
  termiiSenderId: 'WelliRecord',

  // Cryptographic Vault Standards
  encryptionAlgorithm: 'AES-256-GCM',

  defaultHmoProvider: 'Hygeia HMO',

  requestTimeoutMs: 20000,
};
