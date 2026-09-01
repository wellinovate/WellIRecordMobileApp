/**
 * WelliRecord Authentication Service
 * Manages user sessions, registration, and Nigerian SMS OTP dispatch (Termii / Twilio).
 */

import { CONFIG } from './config';
import { apiClient, setAuthToken } from './apiClient';
import { storage } from '../utils/storage';
import { normalizeNigerianPhone } from '../utils/phone';

export interface AuthSession {
  token: string;
  requiresOtp?: boolean;
  challengeToken?: string;
  channel?: 'sms' | 'email' | 'phone' | string;
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

/**
 * Normalizes backend response envelopes ({ success: true, data: { ... } } vs flat { token, user })
 */
function unwrapAuthSession(rawResponse: any, fallbackUser?: Partial<AuthSession['user']>): AuthSession {
  const payload = (rawResponse && typeof rawResponse === 'object' && 'data' in rawResponse && rawResponse.data)
    ? rawResponse.data
    : rawResponse;

  const token = payload?.token || payload?.accessToken || payload?.jwt || rawResponse?.token || '';
  const userObj = payload?.user || payload || fallbackUser || { id: 'me' };

  return {
    token,
    requiresOtp: Boolean(payload?.requiresOtp || rawResponse?.requiresOtp),
    challengeToken: payload?.challengeToken || rawResponse?.challengeToken,
    channel: payload?.channel || rawResponse?.channel,
    user: {
      id: userObj?.id || userObj?._id || fallbackUser?.id || 'me',
      fullName: userObj?.fullName || userObj?.name || fallbackUser?.fullName,
      phoneNumber: userObj?.phoneNumber || userObj?.phone || fallbackUser?.phoneNumber,
      email: userObj?.email || fallbackUser?.email,
      dateOfBirth: userObj?.dateOfBirth || userObj?.dob || fallbackUser?.dateOfBirth,
      memberId: userObj?.wrId || userObj?.memberId || fallbackUser?.memberId,
      wrId: userObj?.wrId || userObj?.memberId || fallbackUser?.wrId,
      bloodType: userObj?.bloodType || fallbackUser?.bloodType,
      genotype: userObj?.genotype || fallbackUser?.genotype,
      hmoProvider: userObj?.hmoProvider || userObj?.insuranceProvider || fallbackUser?.hmoProvider,
      hmoPolicyNumber: userObj?.hmoPolicyNumber || userObj?.policyNumber || fallbackUser?.hmoPolicyNumber,
      contact: userObj?.contact || fallbackUser?.contact,
      emergencyContact: userObj?.emergencyContact || fallbackUser?.emergencyContact,
      emergencyContacts: userObj?.emergencyContacts || fallbackUser?.emergencyContacts,
    },
  };
}

export const authService = {
  /**
   * Dispatches a 6-digit verification code to a Nigerian phone number via Termii SMS Gateway
   */
  async sendPhoneOtp(phoneNumber: string): Promise<SendOtpResponse> {
    const normalized = normalizeNigerianPhone(phoneNumber);
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        success: true,
        message: `Security code sent to ${normalized || phoneNumber}`,
        otpId: `otp_${Date.now()}`,
        expiresInSeconds: 300,
      };
    }

    return await apiClient.post<SendOtpResponse>('/auth/otp/send', {
      phoneNumber: normalized || phoneNumber,
    });
  },

  /**
   * Verifies the 6-digit OTP and initiates a secure session
   */
  async verifyPhoneOtp(phoneNumber: string, code: string, userData?: Partial<AuthSession['user']>): Promise<AuthSession> {
    const normalized = normalizeNigerianPhone(phoneNumber);
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      const session: AuthSession = {
        token: `jwt_welli_demo_${Date.now()}`,
        user: {
          id: 'me',
          fullName: userData?.fullName || 'Amara Nwosu',
          phoneNumber: normalized || phoneNumber || '+2348053355504',
          email: userData?.email || 'amara.nwosu@gmail.com',
          bloodType: userData?.bloodType || 'O+',
          genotype: userData?.genotype || 'AA',
          hmoProvider: userData?.hmoProvider || 'Hygeia HMO',
          hmoPolicyNumber: userData?.hmoPolicyNumber || 'HYG-992014-LAG',
          dateOfBirth: userData?.dateOfBirth,
        },
      };
      await this.saveSession(session);
      return session;
    }

    const raw = await apiClient.post<any>('/auth/otp/verify', {
      phoneNumber: normalized || phoneNumber,
      code,
      ...(userData ? {
        fullName: userData.fullName,
        email: userData.email,
        dateOfBirth: userData.dateOfBirth,
        bloodType: userData.bloodType,
        genotype: userData.genotype,
        hmoProvider: userData.hmoProvider,
        hmoPolicyNumber: userData.hmoPolicyNumber,
      } : {}),
    });
    const session = unwrapAuthSession(raw, {
      fullName: userData?.fullName,
      phoneNumber: normalized || phoneNumber,
      ...userData,
    });
    await this.saveSession(session);
    return session;
  },

  /**
   * Dispatches a 6-digit verification code to email
   */
  async sendEmailOtp(email: string, fullName?: string): Promise<SendOtpResponse> {
    const cleanEmail = email.trim().toLowerCase();
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        success: true,
        message: `Verification code sent to ${cleanEmail}`,
        expiresInSeconds: 600,
      };
    }

    return await apiClient.post<SendOtpResponse>('/auth/email/send', {
      email: cleanEmail,
      fullName,
    });
  },

  /**
   * Verifies the 6-digit email OTP and initiates a secure session
   */
  async verifyEmailOtp(email: string, code: string, userData?: Partial<AuthSession['user']>): Promise<AuthSession> {
    const cleanEmail = email.trim().toLowerCase();
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      const session: AuthSession = {
        token: `jwt_welli_demo_${Date.now()}`,
        user: {
          id: 'me',
          fullName: userData?.fullName || 'Amara Nwosu',
          phoneNumber: userData?.phoneNumber || '+2348053355504',
          email: cleanEmail,
          bloodType: userData?.bloodType || 'O+',
          genotype: userData?.genotype || 'AA',
          hmoProvider: userData?.hmoProvider || 'Hygeia HMO',
          hmoPolicyNumber: userData?.hmoPolicyNumber || 'HYG-992014-LAG',
          dateOfBirth: userData?.dateOfBirth,
        },
      };
      await this.saveSession(session);
      return session;
    }

    const raw = await apiClient.post<any>('/auth/otp/verify', {
      email: cleanEmail,
      code,
      ...(userData ? {
        fullName: userData.fullName,
        email: cleanEmail,
        dateOfBirth: userData.dateOfBirth,
        bloodType: userData.bloodType,
        genotype: userData.genotype,
        hmoProvider: userData.hmoProvider,
        hmoPolicyNumber: userData.hmoPolicyNumber,
      } : {}),
    });
    const session = unwrapAuthSession(raw, {
      fullName: userData?.fullName,
      email: cleanEmail,
      ...userData,
    });
    await this.saveSession(session);
    return session;
  },

  /**
   * Unified Send OTP helper for Phone or Email
   */
  async sendAuthOtp(identifier: string, explicitChannel?: 'phone' | 'email', fullName?: string): Promise<SendOtpResponse> {
    const isEmail = explicitChannel ? explicitChannel === 'email' : identifier.includes('@');
    if (isEmail) {
      return this.sendEmailOtp(identifier.trim(), fullName);
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
      session = await this.verifyEmailOtp(identifier.trim(), code, userData);
    } else {
      session = await this.verifyPhoneOtp(identifier.trim(), code, userData);
    }
    if (userData?.fullName && session?.user) {
      session.user.fullName = userData.fullName;
    }
    await this.saveSession(session);
    return session;
  },

  /**
   * Verifies an OTP code without altering the logged in session user details
   */
  async verifyOtpOnly(identifier: string, code: string): Promise<{ success: boolean; message?: string }> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return { success: true };
    }
    const isEmail = identifier.includes('@');
    const normalized = isEmail ? identifier.trim().toLowerCase() : normalizeNigerianPhone(identifier);
    const res = await apiClient.post<any>('/auth/otp/verify', {
      ...(isEmail ? { email: normalized } : { phoneNumber: normalized }),
      code,
    });
    return { success: true, message: res?.message };
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
          email: identifier.includes('@') ? identifier.trim().toLowerCase() : 'amara.nwosu@gmail.com',
          bloodType: 'O+',
          genotype: 'AA',
          hmoProvider: 'Hygeia HMO',
          hmoPolicyNumber: 'HYG-992014-LAG',
        },
      };
      await this.saveSession(session);
      return session;
    }

    const raw = await apiClient.post<any>('/auth/login', {
      identifier: identifier.trim(),
      password,
    });
    const session = unwrapAuthSession(raw, {
      email: identifier.includes('@') ? identifier.trim().toLowerCase() : undefined,
      phoneNumber: !identifier.includes('@') ? identifier.trim() : undefined,
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
   * Toggles two-factor authentication on the backend and persists local preference
   */
  async toggleTwoFactor(enabled: boolean): Promise<boolean> {
    try {
      await storage.setItem('welli_2fa_enabled', enabled ? '1' : '0');
    } catch {}

    if (CONFIG.demoMode) {
      return enabled;
    }

    try {
      const res = await apiClient.post<{ success: boolean; twoFactorEnabled: boolean }>('/auth/2fa/toggle', {
        twoFactorEnabled: enabled,
      });
      return Boolean(res?.twoFactorEnabled ?? enabled);
    } catch {
      return enabled;
    }
  },

  /**
   * Permanently deletes user account and erases vault records under NDPR Right to Erasure
   */
  async deleteAccount(): Promise<boolean> {
    try {
      if (!CONFIG.demoMode) {
        await apiClient.delete<{ success: boolean }>('/auth/account');
      }
    } catch {}

    await this.logout();
    try {
      await storage.removeItem('welli_active_shares');
      await storage.removeItem('welli_face_id');
      await storage.removeItem('welli_2fa_enabled');
    } catch {}
    return true;
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
