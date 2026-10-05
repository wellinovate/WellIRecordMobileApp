import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { formatDob } from '../utils/formatDate';
import { offlineSyncService } from '../services/offlineSyncService';
import { sharingService } from '../services/sharingService';
import { notificationService } from '../services/notificationService';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

type QrState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; offline: boolean }
  | { status: 'unavailable' };

export function EmergencyModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showEmergency) return null;

  const emergencyMember =
    family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isDependent = emergencyMember.role === 'dependent';
  const guardianLine = isDependent ? `Guardian: ${family[0].name}` : null;

  const [qr, setQr] = useState<QrState>({ status: 'loading' });
  const [isRevoking, setIsRevoking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleSimulateScan = async () => {
    setIsSimulating(true);
    hapticFeedback.medium();
    try {
      await notificationService.triggerTestEmergencyAlert();
      setFeedbackMsg('🚨 Scan alert sent! Look for the alert banner on screen.');
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch {
      setFeedbackMsg('Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRevokeActive = async () => {
    if (qr.status !== 'ready' || !qr.url) return;
    const token = qr.url.split('/').pop() || '';
    if (!token) return;

    setIsRevoking(true);
    hapticFeedback.warning();
    try {
      await notificationService.revokeEmergencyToken(token);
      setFeedbackMsg('🔒 QR Code revoked & locked. Generating new secure link...');
      setQr({ status: 'loading' });
      const newLink = await sharingService.createEmergencyShareLink(emergencyMember.id);
      setQr({ status: 'ready', url: newLink.shareUrl, offline: false });
      setFeedbackMsg('✅ New secure emergency QR generated!');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch {
      setFeedbackMsg('Failed to revoke link');
    } finally {
      setIsRevoking(false);
    }
  };

  // The QR code must encode a real, server-issued, token-gated share link —
  // never a URL built client-side from a predictable id (wrId / family
  // member id), which anyone could guess and use to pull this profile with
  // no grant at all. When online, request a fresh link and cache it for
  // offline use; when offline, fall back to the last link actually issued
  // (never to a freshly-fabricated guess).
  useEffect(() => {
    if (!emergencyMember) return;
    let cancelled = false;
    setQr({ status: 'loading' });

    (async () => {
      if (offlineSyncService.isOnline()) {
        try {
          const link = await sharingService.createEmergencyShareLink(emergencyMember.id);
          if (cancelled) return;
          setQr({ status: 'ready', url: link.shareUrl, offline: false });
          await offlineSyncService.cacheEmergencyProfile({
            id: emergencyMember.id,
            name: emergencyMember.name,
            wrId: emergencyMember.wrId,
            dob: emergencyMember.dob,
            bloodType: emergencyMember.bloodType,
            genotype: emergencyMember.genotype,
            allergies: emergencyMember.allergies,
            conditions: emergencyMember.conditions,
            contact: emergencyMember.contact,
            emergencyContacts: emergencyMember.emergencyContacts,
            hmoProvider: (emergencyMember as any).hmoProvider,
            hmoPolicyNumber: (emergencyMember as any).hmoPolicyNumber,
            qrPayload: link.shareUrl,
          });
          return;
        } catch (err) {
          console.warn('[EmergencyModal] Failed to create a fresh share link, falling back to cache:', err);
        }
      }

      const cached = await offlineSyncService.getCachedEmergencyProfile();
      if (cancelled) return;
      if (cached && cached.id === emergencyMember.id && cached.qrPayload) {
        setQr({ status: 'ready', url: cached.qrPayload, offline: true });
      } else {
        setQr({ status: 'unavailable' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emergencyMember?.id]);

  const handleCallContact = () => {
    const phoneDigits = emergencyMember.contact.replace(/[^0-9+]/g, '');
    if (phoneDigits) {
      hapticFeedback.medium();
      Linking.openURL(`tel:${phoneDigits}`).catch(() => {});
    }
  };

  return (
    <Modal
      visible={state.showEmergency}
      animationType="fade"
      transparent={false}
      onRequestClose={actions.closeEmergency}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Emergency Medical ID"
          dark
          onClose={actions.closeEmergency}
          onBack={actions.closeEmergency}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {/* Main ID Card */}
          <LinearGradient
            colors={['#020617', '#1e3a8a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.idCard}
          >
            <View style={styles.badgeRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                    stroke="#fbbf24"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.idCardBadgeText}>Emergency Medical ID</Text>
              </View>

              {qr.status === 'ready' ? (
                <View style={styles.offlineReadyPill}>
                  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.offlineReadyText}>
                    {qr.offline ? 'Offline Cached' : 'Secure Link Ready'}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.memberName}>{emergencyMember.name}</Text>
            {emergencyMember.wrId ? (
              <Text style={[styles.dobText, { color: '#38bdf8', fontWeight: '700', marginBottom: 2 }]}>
                ID: {emergencyMember.wrId}
              </Text>
            ) : null}
            <Text style={styles.dobText}>DOB: {formatDob(emergencyMember.dob)}</Text>
            {guardianLine ? (
              <Text style={styles.guardianText}>{guardianLine}</Text>
            ) : null}

            <View style={styles.gridTwo}>
              <View>
                <Text style={styles.fieldLabel}>Blood Type</Text>
                <Text style={styles.fieldValue}>{emergencyMember.bloodType}</Text>
              </View>
              <View>
                <Text style={styles.fieldLabel}>Genotype</Text>
                <Text style={styles.fieldValue}>{emergencyMember.genotype}</Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Allergies</Text>
              <Text style={styles.fieldValue}>{emergencyMember.allergies}</Text>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Conditions</Text>
              <Text style={styles.fieldValue}>{emergencyMember.conditions}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Emergency Contact</Text>
              <Text style={styles.contactValue}>{emergencyMember.contact}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCallContact}
                style={styles.callContactBtn}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="#ffffff"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.callContactBtnText}>Call Emergency Contact</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* First Responders QR Box */}
          <View style={styles.qrCard}>
            {qr.status === 'ready' ? (
              <>
                <QRCode value={qr.url} size={140} color="#0f172a" backgroundColor="#ffffff" />
                <Text style={styles.qrCaption}>
                  {qr.offline
                    ? 'Showing the last link generated while online — reconnect to refresh it'
                    : 'First responders can scan for a secure, time-limited medical profile'}
                </Text>
              </>
            ) : qr.status === 'loading' ? (
              <>
                <ActivityIndicator color="#0f172a" />
                <Text style={styles.qrCaption}>Generating a secure share link…</Text>
              </>
            ) : (
              <Text style={styles.qrCaption}>
                Couldn't generate a secure share link. Connect to the internet and reopen this
                screen to try again.
              </Text>
            )}
          </View>

          {/* Access Guard & Test Simulation Card */}
          <View style={styles.guardCard}>
            <View style={styles.guardHeader}>
              <View style={styles.shieldBadge}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke="#10b981"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.shieldBadgeText}>Scan Guard Armed</Text>
              </View>
              <Text style={styles.guardSub}>Real-Time Security Push</Text>
            </View>

            <Text style={styles.guardDesc}>
              Any scan of this QR code immediately triggers a high-priority push notification to your phone with the responder's IP and timestamp.
            </Text>

            {feedbackMsg && (
              <View style={styles.feedbackBanner}>
                <Text style={styles.feedbackText}>{feedbackMsg}</Text>
              </View>
            )}

            <View style={styles.guardActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSimulateScan}
                disabled={isSimulating}
                style={styles.simulateBtn}
              >
                {isSimulating ? (
                  <ActivityIndicator size="small" color="#991b1b" />
                ) : (
                  <Text style={styles.simulateBtnText}>🚨 Test First Responder Alert</Text>
                )}
              </TouchableOpacity>

              {qr.status === 'ready' && !qr.offline && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleRevokeActive}
                  disabled={isRevoking}
                  style={styles.revokeQrBtn}
                >
                  {isRevoking ? (
                    <ActivityIndicator size="small" color="#f43f5e" />
                  ) : (
                    <Text style={styles.revokeQrBtnText}>Revoke Active QR</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050d1a',
  },
  closeHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20,
  },
  idCard: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
    elevation: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  idCardBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  memberName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 3,
  },
  dobText: {
    color: '#93a5c9',
    fontSize: 13,
    marginBottom: 6,
  },
  guardianText: {
    color: '#fbbf24',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 16,
  },
  gridTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#6b87b3',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
    fontWeight: '600',
  },
  fieldValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 10,
  },
  contactValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  qrCaption: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  offlineReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  offlineReadyText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '700',
  },
  callContactBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  callContactBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  guardCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    borderRadius: 18,
    padding: 16,
    width: '100%',
    maxWidth: 280,
    marginTop: 4,
    gap: 10,
  },
  guardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  shieldBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  guardSub: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '600',
  },
  guardDesc: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  feedbackBanner: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    borderRadius: 8,
    padding: 8,
  },
  feedbackText: {
    color: '#7dd3fc',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  guardActions: {
    gap: 8,
    marginTop: 2,
  },
  simulateBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateBtnText: {
    color: '#9f1239',
    fontSize: 11,
    fontWeight: '700',
  },
  revokeQrBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revokeQrBtnText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '700',
  },
});
