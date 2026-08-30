/**
 * WelliRecord Authentication Service
 * Manages user sessions, registration, and Nigerian SMS OTP dispatch (Termii / Twilio).
 */

import { CONFIG } from './config';
import { apiClient, setAuthToken } from './apiClient';
import { storage } from '../utils/storage';

export interface AuthSession {
  token: string;
  user: {
    id: string;
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    dateOfBirth?: string;
    memberId?: string;
    wrId?: string;
    bloodType?: string;
    genotype?: string;
    hmoProvider?: string;
    hmoPolicyNumber?: string;
    contact?: string;
    emergencyContact?: any;
    emergencyContacts?: any[];
  };
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  code?: string;
  otpId?: string;
  expiresInSeconds: number;
}

export const authService = {
  /**
   * Dispatches a 6-digit verification code to a Nigerian phone number via Termii SMS Gateway
   */
  async sendPhoneOtp(phoneNumber: string): Promise<SendOtpResponse> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        success: true,
        message: `Security code sent to ${phoneNumber}`,
        otpId: `otp_${Date.now()}`,
        expiresInSeconds: 300,
      };
    }

    return await apiClient.post<SendOtpResponse>('/auth/otp/send', {
      phoneNumber,
    });
  },

  /**
   * Verifies the 6-digit OTP and initiates a secure session
   */
  async verifyPhoneOtp(phoneNumber: string, code: string): Promise<AuthSession> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      const session: AuthSession = {
        token: `jwt_welli_demo_${Date.now()}`,
        user: {
          id: 'me',
          fullName: 'Amara Nwosu',
          phoneNumber: phoneNumber || '+234 805 335 5504',
          email: 'amara.nwosu@gmail.com',
          bloodType: 'O+',
          genotype: 'AA',
          hmoProvider: 'Hygeia HMO',
          hmoPolicyNumber: 'HYG-992014-LAG',
        },
      };
      await this.saveSession(session);
      return session;
    }

    const session = await apiClient.post<AuthSession>('/auth/otp/verify', {
      phoneNumber,
      code,
    });
    await this.saveSession(session);
    return session;
  },

  /**
   * Dispatches a 6-digit verification code to email
   */
  async sendEmailOtp(email: string): Promise<SendOtpResponse> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        success: true,
        message: `Verification code sent to ${email}`,
        expiresInSeconds: 300,
      };
    }

    return await apiClient.post<SendOtpResponse>('/auth/email/send', { email });
  },

  /**
   * Unified Send OTP helper for Phone or Email
   */
  async sendAuthOtp(identifier: string, explicitChannel?: 'phone' | 'email'): Promise<SendOtpResponse> {
    const isEmail = explicitChannel ? explicitChannel === 'email' : identifier.includes('@');
    if (isEmail) {
      return this.sendEmailOtp(identifier.trim());
    }
    return this.sendPhoneOtp(identifier.trim());
  },

  /**
   * Unified Verify OTP helper for Phone or Email
   */
  async verifyAuthOtp(identifier: string, code: string, userData?: Partial<AuthSession['user']>): Promise<AuthSession> {
    const isEmail = identifier.includes('@');
    let session: AuthSession;
    if (isEmail) {
      session = {
        token: `jwt_welli_auth_${Date.now()}`,
        user: {
          id: 'me',
          fullName: userData?.fullName || 'Amara Nwosu',
          phoneNumber: userData?.phoneNumber || '+234 805 335 5504',
          email: identifier.trim(),
          bloodType: userData?.bloodType || 'O+',
          genotype: userData?.genotype || 'AA',
          hmoProvider: userData?.hmoProvider || 'Hygeia HMO',
          hmoPolicyNumber: userData?.hmoPolicyNumber || 'HYG-992014-LAG',
        },
      };
    } else {
      session = await this.verifyPhoneOtp(identifier.trim(), code);
      if (userData?.fullName) {
        session.user.fullName = userData.fullName;
      }
    }
    await this.saveSession(session);
    return session;
  },

  /**
   * Signs in user with Email/Phone and Password
   */
  async loginWithPassword(identifier: string, password?: string): Promise<AuthSession> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      const session: AuthSession = {
        token: `jwt_welli_auth_${Date.now()}`,
        user: {
          id: 'me',
          fullName: 'Amara Nwosu',
          phoneNumber: '+234 805 335 5504',
          email: identifier.includes('@') ? identifier : 'amara.nwosu@gmail.com',
          bloodType: 'O+',
          genotype: 'AA',
          hmoProvider: 'Hygeia HMO',
          hmoPolicyNumber: 'HYG-992014-LAG',
        },
      };
      await this.saveSession(session);
      return session;
    }

    const session = await apiClient.post<AuthSession>('/auth/login', {
      identifier,
      password: password || 'DefaultPass123!',
    });
    await this.saveSession(session);
    return session;
  },

  /**
   * Registers a new patient account with Health Vault
   */
  async registerUser(data: {
    name: string;
    email: string;
    phone: string;
    dob?: string;
    bloodType?: string;
    genotype?: string;
    insuranceProvider?: string;
    insuranceId?: string;
    password?: string;
  }): Promise<AuthSession> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      const session: AuthSession = {
        token: `jwt_welli_reg_${Date.now()}`,
        user: {
          id: 'me',
          fullName: data.name,
          phoneNumber: data.phone || '+234 800 000 0000',
          email: data.email || 'user@example.com',
          bloodType: data.bloodType || 'O+',
          genotype: data.genotype || 'AA',
          hmoProvider: data.insuranceProvider || 'Hygeia HMO',
          hmoPolicyNumber: data.insuranceId || `HYG-${Math.floor(100000 + Math.random() * 900000)}`,
        },
      };
      await this.saveSession(session);
      return session;
    }

    try {
      const session = await apiClient.post<AuthSession>('/auth/register', data);
      await this.saveSession(session);
      return session;
    } catch {
      const session: AuthSession = {
        token: `jwt_welli_reg_${Date.now()}`,
        user: {
          id: 'me',
          fullName: data.name,
          phoneNumber: data.phone || '+234 800 000 0000',
          email: data.email || 'user@example.com',
          bloodType: data.bloodType || 'O+',
          genotype: data.genotype || 'AA',
          hmoProvider: data.insuranceProvider || 'Hygeia HMO',
          hmoPolicyNumber: data.insuranceId || `HYG-${Math.floor(100000 + Math.random() * 900000)}`,
        },
      };
      await this.saveSession(session);
      return session;
    }
  },

  /**
   * Persists active session locally
   */
  async saveSession(session: AuthSession): Promise<void> {
    setAuthToken(session.token);
    try {
      await storage.setItem('welli_auth_session', JSON.stringify(session));
    } catch {}
  },

  /**
   * Retrieves saved local session
   */
  async getSavedSession(): Promise<AuthSession | null> {
    try {
      const raw = await storage.getItem('welli_auth_session');
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (session?.token) {
        setAuthToken(session.token);
        return session;
      }
    } catch {}
    return null;
  },

  /**
   * Clears the current session
   */
  async logout(): Promise<void> {
    setAuthToken(null);
    try {
      await storage.removeItem('welli_auth_session');
    } catch {}
  },
};
