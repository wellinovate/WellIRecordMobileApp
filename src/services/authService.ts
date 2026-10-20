/**
 * WelliRecord Authentication Service
 * Manages user sessions, registration, and Nigerian SMS/email OTP dispatch.
 */

import { apiClient, setAuthToken } from './apiClient';
import { registerForPushNotificationsAsync } from './pushNotifications';
import { storage } from '../utils/secureStorage';
import { normalizeNigerianPhone } from '../utils/phone';

export interface AuthSession {
  token: string;
  requiresOtp?: boolean;
  challengeToken?: string;
  channel?: 'sms' | 'email' | 'phone' | string;
  /** The account has an authenticator code turned on. No token yet: call verifyMfa. */
  mfaRequired?: boolean;
  mfaToken?: string;
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

export interface AuthRequestOptions {
  /**
   * Pending auth screens use persist=false so a verified backend response does
   * not enter the app before the user reaches the final success screen.
   */
  persist?: boolean;
  challengeToken?: string;
}

/**
 * Normalizes backend response envelopes ({ success: true, data: { ... } })
 * and flat responses ({ token, user }).
 */
function unwrapAuthSession(
  rawResponse: any,
  fallbackUser?: Partial<AuthSession['user']>,
): AuthSession {
  const payload =
    rawResponse &&
    typeof rawResponse === 'object' &&
    'data' in rawResponse &&
    rawResponse.data
      ? rawResponse.data
      : rawResponse;

  const token =
    payload?.token ||
    payload?.accessToken ||
    payload?.jwt ||
    rawResponse?.token ||
    '';

  const userObj = payload?.user || payload || fallbackUser || { id: 'me' };

  return {
    token,
    requiresOtp: Boolean(payload?.requiresOtp || rawResponse?.requiresOtp),
    challengeToken:
      payload?.challengeToken || rawResponse?.challengeToken,
    channel: payload?.channel || rawResponse?.channel,
    mfaRequired: Boolean(payload?.mfaRequired || rawResponse?.mfaRequired),
    mfaToken: payload?.mfaToken || rawResponse?.mfaToken,
    user: {
      id: userObj?.id || userObj?._id || fallbackUser?.id || 'me',
      fullName:
        userObj?.fullName || userObj?.name || fallbackUser?.fullName,
      phoneNumber:
        userObj?.phoneNumber ||
        userObj?.phone ||
        fallbackUser?.phoneNumber,
      email: userObj?.email || fallbackUser?.email,
      dateOfBirth:
        userObj?.dateOfBirth || userObj?.dob || fallbackUser?.dateOfBirth,
      memberId:
        userObj?.wrId || userObj?.memberId || fallbackUser?.memberId,
      wrId: userObj?.wrId || userObj?.memberId || fallbackUser?.wrId,
      bloodType: userObj?.bloodType || fallbackUser?.bloodType,
      genotype: userObj?.genotype || fallbackUser?.genotype,
      hmoProvider:
        userObj?.hmoProvider ||
        userObj?.insuranceProvider ||
        fallbackUser?.hmoProvider,
      hmoPolicyNumber:
        userObj?.hmoPolicyNumber ||
        userObj?.policyNumber ||
        fallbackUser?.hmoPolicyNumber,
      contact: userObj?.contact || fallbackUser?.contact,
      emergencyContact:
        userObj?.emergencyContact || fallbackUser?.emergencyContact,
      emergencyContacts:
        userObj?.emergencyContacts || fallbackUser?.emergencyContacts,
    },
  };
}

export const authService = {
  /**
   * Signs every other device out. This device keeps working on a fresh token.
   */
  async signOutOtherDevices(): Promise<void> {
    const res = await apiClient.post<{ success: boolean; token: string }>('/auth/sessions/revoke-others', {});
    const saved = await this.getSavedSession();
    if (saved && res?.token) {
      await this.saveSession({ ...saved, token: res.token });
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/password/forgot', {
      email: email.trim().toLowerCase(),
    });
  },

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await apiClient.post('/auth/password/reset', {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      newPassword,
    });
  },

  async sendPhoneOtp(
    phoneNumber: string,
    mode: 'login' | 'signup' = 'signup',
  ): Promise<SendOtpResponse> {
    const normalized = normalizeNigerianPhone(phoneNumber);

    return await apiClient.post<SendOtpResponse>('/auth/otp/send', {
      phoneNumber: normalized || phoneNumber,
      mode,
    });
  },

  async verifyPhoneOtp(
    phoneNumber: string,
    code: string,
    userData?: Partial<AuthSession['user']>,
    options: AuthRequestOptions = {},
  ): Promise<AuthSession> {
    const normalized = normalizeNigerianPhone(phoneNumber);

    const raw = await apiClient.post<any>('/auth/otp/verify', {
      phoneNumber: normalized || phoneNumber,
      code,
      ...(options.challengeToken
        ? { challengeToken: options.challengeToken }
        : {}),
      ...(userData
        ? {
            fullName: userData.fullName,
            email: userData.email,
            dateOfBirth: userData.dateOfBirth,
            bloodType: userData.bloodType,
            genotype: userData.genotype,
            hmoProvider: userData.hmoProvider,
            hmoPolicyNumber: userData.hmoPolicyNumber,
          }
        : {}),
    });

    const session = unwrapAuthSession(raw, {
      fullName: userData?.fullName,
      phoneNumber: normalized || phoneNumber,
      ...userData,
    });

    if (options.persist !== false && session.token) {
      await this.saveSession(session);
    }

    return session;
  },

  async sendEmailOtp(
    email: string,
    fullName?: string,
    mode: 'login' | 'signup' = 'signup',
  ): Promise<SendOtpResponse> {
    const cleanEmail = email.trim().toLowerCase();

    return await apiClient.post<SendOtpResponse>('/auth/email/send', {
      email: cleanEmail,
      fullName,
      mode,
    });
  },

  async verifyEmailOtp(
    email: string,
    code: string,
    userData?: Partial<AuthSession['user']>,
    options: AuthRequestOptions = {},
  ): Promise<AuthSession> {
    const cleanEmail = email.trim().toLowerCase();

    const raw = await apiClient.post<any>('/auth/otp/verify', {
      email: cleanEmail,
      code,
      ...(options.challengeToken
        ? { challengeToken: options.challengeToken }
        : {}),
      ...(userData
        ? {
            fullName: userData.fullName,
            email: cleanEmail,
            dateOfBirth: userData.dateOfBirth,
            bloodType: userData.bloodType,
            genotype: userData.genotype,
            hmoProvider: userData.hmoProvider,
            hmoPolicyNumber: userData.hmoPolicyNumber,
          }
        : {}),
    });

    const session = unwrapAuthSession(raw, {
      fullName: userData?.fullName,
      email: cleanEmail,
      ...userData,
    });

    if (options.persist !== false && session.token) {
      await this.saveSession(session);
    }

    return session;
  },

  async sendAuthOtp(
    identifier: string,
    explicitChannel?: 'phone' | 'email',
    fullName?: string,
    mode: 'login' | 'signup' = 'signup',
  ): Promise<SendOtpResponse> {
    const isEmail = explicitChannel
      ? explicitChannel === 'email'
      : identifier.includes('@');

    if (isEmail) {
      return this.sendEmailOtp(identifier.trim(), fullName, mode);
    }

    return this.sendPhoneOtp(identifier.trim(), mode);
  },

  async verifyAuthOtp(
    identifier: string,
    code: string,
    userData?: Partial<AuthSession['user']>,
    options: AuthRequestOptions = {},
  ): Promise<AuthSession> {
    const isEmail = identifier.includes('@');

    const session = isEmail
      ? await this.verifyEmailOtp(
          identifier.trim(),
          code,
          userData,
          options,
        )
      : await this.verifyPhoneOtp(
          identifier.trim(),
          code,
          userData,
          options,
        );

    if (userData?.fullName && session?.user) {
      session.user.fullName = userData.fullName;
    }

    return session;
  },

  /**
   * Validates a code without persisting or switching the app's active session.
   * Used for pre-registration email/phone verification.
   */
  async verifyOtpOnly(
    identifier: string,
    code: string,
    challengeToken?: string,
  ): Promise<{ success: boolean; message?: string }> {

    const isEmail = identifier.includes('@');
    const normalized = isEmail
      ? identifier.trim().toLowerCase()
      : normalizeNigerianPhone(identifier);

    const res = await apiClient.post<any>('/auth/otp/verify', {
      ...(isEmail
        ? { email: normalized }
        : { phoneNumber: normalized }),
      code,
      ...(challengeToken ? { challengeToken } : {}),
    });

    if (res?.success === false) {
      throw new Error(res?.message || 'The verification code is invalid.');
    }

    return { success: true, message: res?.message };
  },

  /**
   * Validates email/phone + password. persist=false is used while the OTP
   * challenge is still pending so App.expo remains inside AuthFlow.
   */
  async loginWithPassword(
    identifier: string,
    password?: string,
    options: AuthRequestOptions = {},
  ): Promise<AuthSession> {

    const raw = await apiClient.post<any>('/auth/login', {
      identifier: identifier.trim(),
      password,
    });

    const session = unwrapAuthSession(raw, {
      email: identifier.includes('@')
        ? identifier.trim().toLowerCase()
        : undefined,
      phoneNumber: !identifier.includes('@')
        ? identifier.trim()
        : undefined,
    });

    // A challenge response is not an authenticated app session yet.
    if (
      options.persist !== false &&
      session.token &&
      !session.requiresOtp
    ) {
      await this.saveSession(session);
    }

    return session;
  },

  /**
   * Finishes a sign-in that came back with mfaRequired. Send either the 6-digit code or a
   * recovery code. Returns the real session (with token) but does not save it.
   */
  async verifyMfa(
    pending: AuthSession,
    proof: { code: string } | { recoveryCode: string },
  ): Promise<AuthSession> {
    const raw = await apiClient.post<any>('/auth/mfa/verify', { mfaToken: pending.mfaToken, ...proof });
    const session = unwrapAuthSession(raw, pending.user);
    if (!session.token) throw new Error('The code was accepted, but no session was returned.');
    return { ...session, mfaRequired: false, mfaToken: undefined };
  },

  async verifySocialAuth(details: {
    provider: 'google' | 'apple';
    email: string;
    fullName?: string;
    /** Clerk session token. The server checks it with Clerk; the email above is only a fallback label. */
    clerkToken: string;
  }): Promise<AuthSession & { isNewAccount?: boolean }> {

    const raw = await apiClient.post<any>('/auth/social/verify', {
      provider: details.provider,
      fullName: details.fullName,
      clerkToken: details.clerkToken,
    });

    const session = unwrapAuthSession(raw, {
      email: details.email.trim().toLowerCase(),
      fullName: details.fullName,
    });

    if (!session.token && !session.mfaRequired) {
      throw new Error('Social authentication did not return a valid session.');
    }

    // With a second step on, the caller asks for the code and saves the session after verifyMfa.
    if (session.token) await this.saveSession(session);
    return { ...session, isNewAccount: raw?.isNewAccount };
  },

  async registerUser(
    data: {
      name: string;
      email: string;
      phone: string;
      dob?: string;
      bloodType?: string;
      genotype?: string;
      insuranceProvider?: string;
      insuranceId?: string;
      password?: string;
    },
    options: AuthRequestOptions = {},
  ): Promise<AuthSession> {

    // Never fabricate a production session when registration fails.
    const raw = await apiClient.post<any>('/auth/register', data);
    const session = unwrapAuthSession(raw, {
      id: 'me',
      fullName: data.name,
      phoneNumber: data.phone,
      email: data.email,
      dateOfBirth: data.dob,
      bloodType: data.bloodType,
      genotype: data.genotype,
      hmoProvider: data.insuranceProvider,
      hmoPolicyNumber: data.insuranceId,
    });

    if (!session.token) {
      throw new Error('Account creation did not return a valid session.');
    }

    if (options.persist !== false) {
      await this.saveSession(session);
    }

    return session;
  },

  async saveSession(session: AuthSession): Promise<void> {
    if (!session?.token) {
      throw new Error('Cannot persist an authentication session without a token.');
    }

    setAuthToken(session.token);

    try {
      await storage.setItem(
        'welli_auth_session',
        JSON.stringify(session),
      );
    } catch {}

    registerForPushNotificationsAsync().catch(() => {});
  },

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

  async toggleTwoFactor(enabled: boolean): Promise<boolean> {
    try {
      await storage.setItem('welli_2fa_enabled', enabled ? '1' : '0');
    } catch {}

    try {
      const res = await apiClient.post<{
        success: boolean;
        twoFactorEnabled: boolean;
      }>('/auth/2fa/toggle', {
        twoFactorEnabled: enabled,
      });

      return Boolean(res?.twoFactorEnabled ?? enabled);
    } catch {
      return enabled;
    }
  },

  async deleteAccount(): Promise<boolean> {
    // Let API failures propagate: the caller must not report a deletion
    // (or sign the user out) when the server did not delete the account.
    await apiClient.delete<{ success: boolean }>('/auth/account');

    await this.logout();

    try {
      await storage.removeItem('welli_active_shares');
      await storage.removeItem('welli_face_id');
      await storage.removeItem('welli_2fa_enabled');
    } catch {}

    return true;
  },

  async logout(): Promise<void> {
    setAuthToken(null);

    try {
      await storage.removeItem('welli_auth_session');
    } catch {}
  },
};
