import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Animated,
  Easing,
  Image,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import {
  pickImageFromCamera,
  pickDocument,
  type PickedMediaResult,
} from '../utils/mediaPicker';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';
import type { RecordType } from '../data/types';

interface OcrPreset {
  type: RecordType;
  label: string;
  emoji: string;
  defaultTitle: string;
  provider: string;
  summary: string;
  keyValues: Array<{ label: string; value: string }>;
}

const OCR_PRESETS: OcrPreset[] = [
  {
    type: 'Lab Result',
    label: 'Lab Report',
    emoji: '🧪',
    defaultTitle: 'Full Blood Count & Malaria MP',
    provider: 'Central City Diagnostic Laboratory',
    summary: 'Hemoglobin 13.8 g/dL (Normal). Malaria MP negative. WBC 6,200/uL within standard limits.',
    keyValues: [
      { label: 'Hemoglobin', value: '13.8 g/dL (Normal)' },
      { label: 'Malaria MP', value: 'Negative (No parasites seen)' },
      { label: 'Platelet Count', value: '240,000 /uL' },
    ],
  },
  {
    type: 'Prescription',
    label: 'Prescription',
    emoji: '💊',
    defaultTitle: 'Augmentin 625mg & Paracetamol',
    provider: 'Dr. Sarah Chen · Riverside Clinic',
    summary: 'Take 1 tablet twice daily after food for 7 days. Completed course recommended.',
    keyValues: [
      { label: 'Dosage', value: '625mg BID × 7 days' },
      { label: 'Prescriber', value: 'Dr. Sarah Chen (MD-88102)' },
      { label: 'HMO Coverage', value: 'Covered (Hygeia HMO)' },
    ],
  },
  {
    type: 'Immunization',
    label: 'Vaccine Card',
    emoji: '💉',
    defaultTitle: 'NPI Child Immunization Entry',
    provider: 'Wellicare Hospital & Child Health',
    summary: 'Rotavirus booster & Pneumococcal PCV series administered and verified.',
    keyValues: [
      { label: 'Vaccine Batch', value: 'PCV-LAG-4409' },
      { label: 'Dose', value: '0.5mL IM' },
      { label: 'Next Due Date', value: 'School Entry Booster' },
    ],
  },
  {
    type: 'Imaging',
    label: 'Radiology Scan',
    emoji: '🩻',
    defaultTitle: 'Chest Digital Radiography (X-Ray)',
    provider: 'Valley Imaging & Diagnostics Center',
    summary: 'No acute cardiopulmonary disease. Lungs clear, heart size within normal limits.',
    keyValues: [
      { label: 'Modality', value: 'Digital X-Ray (PA View)' },
      { label: 'Radiologist', value: 'Dr. T. Alabi (FRCR)' },
    ],
  },
  {
    type: 'Receipt',
    label: 'Medical Receipt',
    emoji: '🧾',
    defaultTitle: 'Pharmacy & Consultation Invoice Receipt',
    provider: 'MediTrust Pharmacy & Diagnostics',
    summary: 'Total ₦14,500. HMO Covered ₦11,600 (80%). Patient Co-Pay ₦2,900 settled.',
    keyValues: [
      { label: 'Total Amount', value: '₦14,500' },
      { label: 'HMO Co-Pay', value: '₦2,900 (Settled)' },
      { label: 'Receipt Ref', value: 'REC-2026-9904' },
    ],
  },
];

export function UploadModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [scanAnim] = useState(() => new Animated.Value(0));
  const [pickedFile, setPickedFile] = useState<PickedMediaResult | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<OcrPreset>(OCR_PRESETS[0]);
  const [targetMemberId, setTargetMemberId] = useState<string>(state.activeFamilyId || 'me');
  const [flashEnabled, setFlashEnabled] = useState(false);

  useEffect(() => {
    if (state.uploadStep === 1) {
      scanAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 200,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      scanAnim.setValue(0);
    }
  }, [state.uploadStep, scanAnim]);

  if (!state.showUpload) return null;

  const handleScanDocument = async (preset: OcrPreset) => {
    hapticFeedback.light();
    setSelectedPreset(preset);
    const result = await pickImageFromCamera(false);
    if (result) {
      setPickedFile(result);
    }
    actions.startScan();
  };

  const handleUploadFiles = async (preset: OcrPreset) => {
    hapticFeedback.light();
    setSelectedPreset(preset);
    const result = await pickDocument();
    if (result) {
      setPickedFile(result);
    }
    actions.startScan();
  };

  const handleSaveToVault = () => {
    hapticFeedback.success();
    const title = pickedFile?.name
      ? pickedFile.name.replace(/\.[^/.]+$/, '')
      : selectedPreset.defaultTitle;

    actions.addRecord({
      ownerId: targetMemberId,
      title,
      date: 'Today · May 14, 2026',
      type: selectedPreset.type,
      provider: selectedPreset.provider,
      summary: selectedPreset.summary,
      extractedOcr: {
        keyValues: selectedPreset.keyValues,
        statusBadge: 'OCR Verified',
      },
    });

    setPickedFile(null);
    actions.closeUpload();
  };

  const currentMember = state.familyMembers.find((f) => f.id === targetMemberId) || state.familyMembers[0];

  return (
    <Modal
      visible={state.showUpload}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        setPickedFile(null);
        actions.closeUpload();
      }}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={state.uploadStep === 1 ? 'OCR Document Scanner' : state.uploadStep === 2 ? 'Scanned Summary' : 'Add Health Record'}
          onClose={() => {
            setPickedFile(null);
            actions.closeUpload();
          }}
          onBack={
            state.uploadStep > 0
              ? () => {
                  setPickedFile(null);
                  actions.openUpload();
                }
              : () => {
                  setPickedFile(null);
                  actions.closeUpload();
                }
          }
        />

        {/* STEP 0: Capture & Category Selection */}
        {state.uploadStep === 0 && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {/* Target Family Member Selector */}
            <View style={styles.memberSelectorCard}>
              <Text style={styles.cardSectionLabel}>SAVING RECORD FOR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberChipRow}>
                {state.familyMembers.map((m) => {
                  const isSelected = m.id === targetMemberId;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        hapticFeedback.selection();
                        setTargetMemberId(m.id);
                      }}
                      style={[styles.memberChip, isSelected && styles.memberChipActive]}
                    >
                      <View style={[styles.memberAvatarCircle, isSelected && styles.memberAvatarActive]}>
                        <Text style={[styles.memberAvatarText, isSelected && styles.memberAvatarTextActive]}>
                          {m.initials}
                        </Text>
                      </View>
                      <Text style={[styles.memberChipText, isSelected && styles.memberChipTextActive]}>
                        {m.name.split(' ')[0]} {m.relationship ? `(${m.relationship})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Document Format Types */}
            <Text style={styles.sectionHeader}>Select Record Category</Text>
            <View style={styles.presetGrid}>
              {OCR_PRESETS.map((preset) => {
                const isSelected = selectedPreset.type === preset.type;
                return (
                  <TouchableOpacity
                    key={preset.type}
                    activeOpacity={0.75}
                    onPress={() => {
                      hapticFeedback.selection();
                      setSelectedPreset(preset);
                    }}
                    style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  >
                    <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                    <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Capture Actions */}
            <Text style={styles.sectionHeader}>Capture Method</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleScanDocument(selectedPreset)}
              style={styles.primaryScanBox}
            >
              <View style={styles.scanIconCircle}>
                <Text style={{ fontSize: 24 }}>📸</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanActionTitle}>Camera Document Scanner</Text>
                <Text style={styles.scanActionSub}>
                  Live edge detection, flash reticle, and instant OCR reading
                </Text>
              </View>
              <Text style={styles.arrowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleUploadFiles(selectedPreset)}
              style={styles.secondaryFileBox}
            >
              <View style={styles.fileIconCircle}>
                <Text style={{ fontSize: 22 }}>📁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileActionTitle}>Import PDF or Photo</Text>
                <Text style={styles.fileActionSub}>
                  Upload digital medical reports, lab slips, or scans
                </Text>
              </View>
              <Text style={styles.arrowChevron}>›</Text>
            </TouchableOpacity>

            {/* Security Badge */}
            <View style={styles.encryptionBadge}>
              <Text style={styles.lockEmoji}>🔒</Text>
              <Text style={styles.encryptionText}>
                Encrypted with AES-256 zero-knowledge client architecture. Only accessible by {currentMember.name}.
              </Text>
            </View>
          </ScrollView>
        )}

        {/* STEP 1: Interactive Viewfinder & OCR Scanning */}
        {state.uploadStep === 1 && (
          <View style={styles.stepOneContainer}>
            <View style={styles.cameraViewport}>
              {/* Flash and Reticle Controls */}
              <View style={styles.cameraHeaderOverlay}>
                <View style={styles.docTypePill}>
                  <Text style={styles.docTypePillText}>{selectedPreset.emoji} {selectedPreset.label}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.light();
                    setFlashEnabled(!flashEnabled);
                  }}
                  style={[styles.flashToggleBtn, flashEnabled && styles.flashToggleActive]}
                >
                  <Text style={styles.flashToggleText}>{flashEnabled ? '⚡ Flash ON' : '💡 Flash Auto'}</Text>
                </TouchableOpacity>
              </View>

              {/* Viewfinder Preview with Corner Brackets */}
              <View style={styles.viewfinder}>
                {pickedFile?.uri && pickedFile.type?.startsWith('image') ? (
                  <Image
                    source={{ uri: pickedFile.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.docPlaceholder}>
                    <Text style={{ fontSize: 48 }}>{selectedPreset.emoji}</Text>
                    <Text style={styles.docPlaceholderTitle}>{selectedPreset.defaultTitle}</Text>
                    <Text style={styles.docPlaceholderSub}>{selectedPreset.provider}</Text>
                  </View>
                )}

                {/* Animated Laser Scanning Beam */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [{ translateY: scanAnim }],
                    },
                  ]}
                />

                {/* 4 Corner Edge Detection Brackets */}
                <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
                <View style={[styles.cornerBracket, styles.bracketTopRight]} />
                <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
                <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
              </View>

              <View style={styles.analyzingFooter}>
                <Text style={styles.analyzingTitle}>Extracting Medical Data…</Text>
                <Text style={styles.analyzingDesc}>
                  Analyzing headers, doctor signatures, and lab reference ranges
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: OCR Extracted Metadata & Save Confirmation */}
        {state.uploadStep === 2 && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.successHeaderCard}>
              <View style={styles.successCircle}>
                <Svg width={28} height={28} viewBox="0 0 20 20">
                  <Path
                    d="M4 10l4 4 8-9"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={styles.successTitle}>Document Digitized & Verified</Text>
              <Text style={styles.successSub}>
                OCR extracted the following clinical data for {currentMember.name}:
              </Text>
            </View>

            {/* Extracted Clinical Metadata Card */}
            <View style={styles.ocrResultCard}>
              <View style={styles.ocrHeaderRow}>
                <Text style={styles.ocrBadgeEmoji}>{selectedPreset.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ocrRecordTitle}>
                    {pickedFile?.name ? pickedFile.name.replace(/\.[^/.]+$/, '') : selectedPreset.defaultTitle}
                  </Text>
                  <Text style={styles.ocrProviderText}>{selectedPreset.provider}</Text>
                </View>
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>✓ Verified</Text>
                </View>
              </View>

              <View style={styles.ocrDivider} />

              <Text style={styles.ocrValuesHeader}>EXTRACTED CLINICAL VALUES</Text>
              <View style={styles.keyValuesGrid}>
                {selectedPreset.keyValues.map((kv) => (
                  <View key={kv.label} style={styles.keyValueRow}>
                    <Text style={styles.kvLabel}>{kv.label}</Text>
                    <Text style={styles.kvValue}>{kv.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.ocrDivider} />

              <Text style={styles.summaryLabel}>CLINICAL SUMMARY</Text>
              <Text style={styles.summaryText}>{selectedPreset.summary}</Text>
            </View>

            {/* Confirm & Save CTA */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSaveToVault}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save to {currentMember.name.split(' ')[0]}'s Health Vault ›</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    padding: 18,
    paddingBottom: 40,
  },
  memberSelectorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  memberChipRow: {
    flexDirection: 'row',
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  memberAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarActive: {
    backgroundColor: '#059669',
  },
  memberAvatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  memberAvatarTextActive: {
    color: '#ffffff',
  },
  memberChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  memberChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  presetCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  presetEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  presetLabelActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  primaryScanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#041E42',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  scanIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanActionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  scanActionSub: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  secondaryFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  fileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileActionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  fileActionSub: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  arrowChevron: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '700',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  lockEmoji: {
    fontSize: 16,
  },
  encryptionText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
  stepOneContainer: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
    justifyContent: 'center',
  },
  cameraViewport: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cameraHeaderOverlay: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docTypePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  docTypePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  flashToggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  flashToggleActive: {
    backgroundColor: '#facc15',
  },
  flashToggleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  viewfinder: {
    width: '90%',
    height: 280,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  docPlaceholder: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  docPlaceholderTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  docPlaceholderSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 30,
    height: 3,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38bdf8',
  },
  bracketTopLeft: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTopRight: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  analyzingFooter: {
    alignItems: 'center',
  },
  analyzingTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  analyzingDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  successHeaderCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  successSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  ocrResultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  ocrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ocrBadgeEmoji: {
    fontSize: 28,
  },
  ocrRecordTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  ocrProviderText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  ocrDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  ocrValuesHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  keyValuesGrid: {
    gap: 8,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  kvLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  kvValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: '#041E42',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
