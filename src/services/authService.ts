/**
 * WelliRecord Authentication Service
 * Manages user sessions, registration, and Nigerian SMS OTP dispatch (Termii / Twilio).
 */

import { CONFIG } from './config';
import { apiClient, setAuthToken } from './apiClient';

export interface AuthSession {
  token: string;
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    bloodType: string;
    genotype: string;
    hmoProvider: string;
    hmoPolicyNumber: string;
  };
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  otpId?: string;
  expiresInSeconds: number;
}

export const authService = {
  /**
   * Dispatches a 6-digit verification code to a Nigerian phone number via Termii SMS Gateway
   */
  async sendPhoneOtp(phoneNumber: string): Promise<SendOtpResponse> {
    if (CONFIG.demoMode) {
      // Simulate network latency in demo mode
      await new Promise((res) => setTimeout(res, 600));
      return {
        success: true,
        message: `Security code sent to ${phoneNumber}. Demo Code: 849201`,
        otpId: `otp_${Date.now()}`,
        expiresInSeconds: 300,
      };
    }

    return apiClient.post<SendOtpResponse>('/auth/otp/send', {
      channel: 'generic',
      to: phoneNumber,
      from: CONFIG.termiiSenderId,
      type: 'numeric',
    });
  },

  /**
   * Verifies the 6-digit OTP and initiates a secure session
   */
  async verifyPhoneOtp(phoneNumber: string, code: string): Promise<AuthSession> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 500));
      const session: AuthSession = {
        token: `jwt_welli_demo_${Date.now()}`,
        user: {
          id: 'u_amara_nwosu',
          fullName: 'Amara Nwosu',
          phoneNumber: phoneNumber || '+234 805 555 5504',
          email: 'amara.nwosu@gmail.com',
          bloodType: 'O+',
          genotype: 'AA',
          hmoProvider: 'Hygeia HMO',
          hmoPolicyNumber: 'HYG-992014-LAG',
        },
      };
      setAuthToken(session.token);
      return session;
    }

    const session = await apiClient.post<AuthSession>('/auth/otp/verify', {
      phoneNumber,
      code,
    });
    setAuthToken(session.token);
    return session;
  },

  /**
   * Dispatches a 6-digit verification code to email
   */
  async sendEmailOtp(email: string): Promise<SendOtpResponse> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 500));
      return {
        success: true,
        message: `Verification code sent to ${email}`,
        expiresInSeconds: 300,
      };
    }

    return apiClient.post<SendOtpResponse>('/auth/email/send', { email });
  },

  /**
   * Clears the current session token
   */
  logout() {
    setAuthToken(null);
  },
};
