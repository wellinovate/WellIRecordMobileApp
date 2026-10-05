/**
 * WelliRecord Sharing & Consent Service
 * Handles WelliBridge temporary token generation, Hospital Organization authorizations, and NDPR audit logging.
 */

import { CONFIG } from './config';
import { apiClient } from './apiClient';
import type { ShareExpiry } from '../data/types';

export interface ShareGrant {
  id: string;
  grantorId: string;
  recipientType: 'doctor' | 'facility' | 'bridge';
  recipientId: string;
  recipientName: string;
  recordIds: string[];
  expiry: ShareExpiry;
  expiresAt: string;
  createdAt: string;
  status: 'active' | 'revoked' | 'expired';
  // Only present for recipientType 'bridge' — the opaque public token and
  // the full redemption URL a QR code should encode.
  shareToken?: string;
  shareUrl?: string;
}

export interface AccessAuditLog {
  id: string;
  timestamp: string;
  accessedByName: string;
  accessorRole: string;
  facilityName: string;
  action: 'view' | 'download' | 'print' | 'revoke';
  recordsAccessedCount: number;
  ipAddress: string;
}

export const sharingService = {
  /**
   * Generates a patient-authorized share grant for an individual doctor or healthcare organization
   */
  async createShareGrant(params: {
    recipientId: string;
    recipientType: 'doctor' | 'facility' | 'bridge';
    recipientName: string;
    recordIds: string[];
    expiry: ShareExpiry;
    otpCode: string;
    // Required when recipientType is 'bridge' — which family member's
    // emergency summary the resulting public token unlocks.
    familyMemberId?: string;
  }): Promise<ShareGrant> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        id: `grant_${Date.now()}`,
        grantorId: 'u_amara_nwosu',
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        recipientName: params.recipientName,
        recordIds: params.recordIds,
        expiry: params.expiry,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active',
        ...(params.recipientType === 'bridge'
          ? { shareToken: 'demo-token', shareUrl: 'https://wellirecordmobileapp.onrender.com/api/v1/shares/bridge/demo-token' }
          : {}),
      };
    }

    return apiClient.post<ShareGrant>('/shares/grants', params);
  },

  /**
   * Creates (or reuses a still-valid) public, token-gated Emergency Medical
   * ID share link for one family member. This is the only safe way to get
   * a URL for the Emergency QR code — it must never be built from a
   * predictable id (wrId, family member id) client-side, since that would
   * let anyone who learns/guesses the id pull PHI with no grant at all.
   */
  async createEmergencyShareLink(familyMemberId: string): Promise<{ shareUrl: string; expiresAt: string }> {
    const grant = await sharingService.createShareGrant({
      recipientId: 'first-responder',
      recipientType: 'bridge',
      recipientName: 'Emergency QR Code',
      recordIds: [],
      expiry: '24h',
      otpCode: '',
      familyMemberId,
    });

    if (!grant.shareUrl) {
      throw new Error('Server did not return a share link for this emergency QR code');
    }

    return { shareUrl: grant.shareUrl, expiresAt: grant.expiresAt };
  },

  /**
   * Revokes an existing share grant immediately
   */
  async revokeGrant(grantId: string): Promise<{ success: boolean }> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return { success: true };
    }

    return apiClient.delete<{ success: boolean }>(`/shares/grants/${grantId}`);
  },

  /**
   * Retrieves access audit trail compliant with Nigeria Data Protection Regulation (NDPR)
   */
  async fetchAuditLogs(): Promise<AccessAuditLog[]> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return [
        {
          id: 'log_1',
          timestamp: 'Today, 2:45 PM',
          accessedByName: 'Dr. Sarah Chen',
          accessorRole: 'Attending Physician',
          facilityName: 'Riverside Family Clinic Lekki',
          action: 'view',
          recordsAccessedCount: 3,
          ipAddress: '102.89.44.12 (Lagos, Nigeria)',
        },
        {
          id: 'log_2',
          timestamp: 'Yesterday, 11:15 AM',
          accessedByName: 'Triage Nursing Team',
          accessorRole: 'Emergency Staff',
          facilityName: 'Lagoon Hospital Lekki',
          action: 'view',
          recordsAccessedCount: 7,
          ipAddress: '105.112.18.90 (Lagos, Nigeria)',
        },
      ];
    }

    return apiClient.get<AccessAuditLog[]>('/shares/audit-logs');
  },
};
