import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function InCallModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [showPostCallSummary, setShowPostCallSummary] = useState(false);

  if (!state.inCall) return null;

  const mins = Math.floor(state.callDurationSec / 60)
    .toString()
    .padStart(2, '0');
  const secs = (state.callDurationSec % 60).toString().padStart(2, '0');
  const callDurationLabel = `${mins}:${secs}`;

  const handleEndCall = () => {
    hapticFeedback.light();
    setShowPostCallSummary(true);
  };

  const handleSyncToVault = () => {
    actions.syncTelehealthVisit({
      doctorName: 'Dr. Sarah Chen',
      diagnosis: 'Hypertension Review & Mild Seasonal Allergic Rhinitis',
      notes:
        'Blood pressure well-controlled on Amlodipine 5mg (124/80 mmHg). Added Loratadine 10mg once daily for seasonal allergy relief. Recommended routine hydration and low-sodium diet.',
      prescriptionName: 'Loratadine 10mg Oral Tablets (10-Day Supply)',
      dosage: '1 tablet once daily in the evening',
    });
    setShowPostCallSummary(false);
  };

  const handleDismissWithoutSync = () => {
    setShowPostCallSummary(false);
    actions.endCall();
  };

  return (
    <Modal
      visible={state.inCall}
      animationType="fade"
      transparent={false}
      onRequestClose={handleDismissWithoutSync}
    >
      <SafeAreaView style={styles.container}>
        {!showPostCallSummary ? (
          /* Live Video Call Screen */
          <View style={styles.liveCallContainer}>
            <LinearGradient
              colors={['#0B1F3A', '#0E5E6F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.videoStage}
            >
              <View style={styles.doctorInitialsCircle}>
                <Text style={styles.doctorInitialsText}>SC</Text>
              </View>

              <View style={styles.stageTopOverlay}>
                <Text style={styles.doctorName}>Dr. Sarah Chen</Text>
                <Text style={styles.doctorSub}>Family & Internal Medicine · Riverside Clinic</Text>
                <View style={styles.durationBadge}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.durationText}>{callDurationLabel}</Text>
                </View>
              </View>

              {/* Patient Self Preview PiP */}
              <View
                style={[
                  styles.pipBox,
                  {
                    backgroundColor: state.callCameraOff ? '#1e293b' : '#334155',
                  },
                ]}
              >
                {state.callCameraOff ? (
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect
                      x="3"
                      y="6"
                      width="13"
                      height="12"
                      rx="2"
                      stroke="#64748b"
                      strokeWidth={1.6}
                    />
                    <Path
                      d="M16 10.5l5-3v9l-5-3"
                      stroke="#64748b"
                      strokeWidth={1.6}
                      fill="none"
                    />
                    <Path
                      d="M4 4l16 16"
                      stroke="#64748b"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                  </Svg>
                ) : (
                  <Text style={{ fontSize: 24 }}>👤</Text>
                )}
                <Text style={styles.pipLabel}>You (Amara)</Text>
              </View>
            </LinearGradient>

            {/* Controls Bar */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.toggleCallMute}
                style={[
                  styles.controlCircle,
                  {
                    backgroundColor: state.callMuted
                      ? '#ffffff'
                      : 'rgba(255,255,255,0.14)',
                  },
                ]}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 16a3 3 0 003-3V6a3 3 0 10-6 0v7a3 3 0 003 3z"
                    stroke={state.callMuted ? '#0f172a' : '#ffffff'}
                    strokeWidth={1.6}
                  />
                  <Path
                    d="M6 11v1a6 6 0 0012 0v-1M12 18v3"
                    stroke={state.callMuted ? '#0f172a' : '#ffffff'}
                    strokeWidth={1.6}
                  />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.toggleCallCamera}
                style={[
                  styles.controlCircle,
                  {
                    backgroundColor: state.callCameraOff
                      ? '#ffffff'
                      : 'rgba(255,255,255,0.14)',
                  },
                ]}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Rect
                    x="3"
                    y="6"
                    width="13"
                    height="12"
                    rx="2"
                    stroke={state.callCameraOff ? '#0f172a' : '#ffffff'}
                    strokeWidth={1.6}
                  />
                  <Path
                    d="M16 10.5l5-3v9l-5-3"
                    stroke={state.callCameraOff ? '#0f172a' : '#ffffff'}
                    strokeWidth={1.6}
                    fill="none"
                  />
                </Svg>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleEndCall}
                style={styles.endCallCircle}
              >
                <Svg
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ transform: [{ rotate: '135deg' }] }}
                >
                  <Path
                    d="M4 12c4-5 12-5 16 0l-2.6 2.6c-.5.5-1.3.6-1.9.2l-2-1.4c-.5-.4-1.2-.3-1.6.1l-1.4 1.4c-.4.4-1.1.5-1.6.1l-2-1.4c-.6-.4-.7-1.2-.2-1.7L4 12z"
                    fill="#ffffff"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Post-Consultation Clinical Sync & Prescription Card */
          <ScrollView
            style={styles.summaryScroll}
            contentContainerStyle={styles.summaryInner}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.summaryHeader}>
              <View style={styles.summaryCheckCircle}>
                <Text style={{ fontSize: 24 }}>✓</Text>
              </View>
              <Text style={styles.summaryTitle}>Telehealth Encounter Concluded</Text>
              <Text style={styles.summarySubtitle}>
                Dr. Sarah Chen has generated your clinical encounter summary and digital prescription.
              </Text>
            </View>

            {/* Doctor & Encounter Card */}
            <View style={styles.doctorEncounterCard}>
              <View style={styles.doctorBadgeAvatar}>
                <Text style={styles.doctorBadgeAvatarText}>SC</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docEncName}>Dr. Sarah Chen (MBBS, FWACP)</Text>
                <Text style={styles.docEncSub}>Consultant Physician · Riverside Family Clinic</Text>
                <Text style={styles.docEncLic}>Medical License: MD-88102 · ISO 27001 Verified</Text>
              </View>
            </View>

            {/* Clinical Notes & Diagnosis */}
            <Text style={styles.sectionLabel}>CLINICAL DIAGNOSIS & ENCOUNTER NOTES</Text>
            <View style={styles.clinicalNotesBox}>
              <View style={styles.diagnosisTag}>
                <Text style={styles.diagnosisTagText}>Primary Diagnosis</Text>
              </View>
              <Text style={styles.diagnosisTitle}>
                Hypertension Review & Mild Seasonal Allergic Rhinitis
              </Text>
              <Text style={styles.clinicalBodyText}>
                Patient presented for routine cardiovascular follow-up. Blood pressure remains well-controlled on Amlodipine 5mg daily. Reported mild sneezing and congestion due to seasonal allergens. Recommended routine hydration and low-sodium diet.
              </Text>
            </View>

            {/* Electronic Prescription Card */}
            <Text style={styles.sectionLabel}>NEW ELECTRONIC PRESCRIPTION GENERATED</Text>
            <View style={styles.newRxCard}>
              <View style={styles.rxIconCircle}>
                <Text style={{ fontSize: 22 }}>💊</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rxName}>Loratadine 10mg Oral Tablets</Text>
                <Text style={styles.rxDosage}>1 tablet once daily in evening · 10-Day Supply</Text>
                <View style={styles.rxHmoRow}>
                  <Text style={styles.rxHmoTag}>Hygeia HMO: ₦2,800 Covered</Text>
                  <Text style={styles.rxCoPayTag}>₦700 Co-Pay</Text>
                </View>
              </View>
            </View>

            {/* NDPR & Clinical Integrity Seal */}
            <View style={styles.integrityBox}>
              <Text style={{ fontSize: 16 }}>🛡️</Text>
              <Text style={styles.integrityText}>
                Digitally certified under NDPR & Nigerian Medical and Dental Council (MDCN) electronic records framework.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.summaryActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSyncToVault}
                style={styles.syncVaultBtn}
              >
                <Text style={styles.syncVaultBtnText}>
                  Sync Note & Prescription to Vault ›
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDismissWithoutSync}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>Exit without Syncing</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  liveCallContainer: {
    flex: 1,
  },
  videoStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  doctorInitialsCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorInitialsText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  stageTopOverlay: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
  },
  doctorName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  doctorSub: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  durationText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pipBox: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 88,
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipLabel: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 4,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 26,
    paddingHorizontal: 20,
    backgroundColor: '#0f172a',
  },
  controlCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  summaryInner: {
    padding: 20,
    paddingBottom: 36,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryCheckCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  summarySubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  doctorEncounterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  doctorBadgeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorBadgeAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  docEncName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  docEncSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  docEncLic: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  clinicalNotesBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  diagnosisTag: {
    backgroundColor: '#eff6ff',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  diagnosisTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  diagnosisTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  clinicalBodyText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  newRxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  rxIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  rxDosage: {
    fontSize: 11.5,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  rxHmoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  rxHmoTag: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '700',
    backgroundColor: '#f0fdf4',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  rxCoPayTag: {
    fontSize: 10.5,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  integrityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  integrityText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  summaryActionsRow: {
    gap: 10,
  },
  syncVaultBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  syncVaultBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  dismissBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
