import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { ocrService, type OcrResult } from '../services/ocrService';
import type { WelliApp } from '../state/useWelliApp';
import type { RecordType } from '../data/types';

interface OcrPreset {
  type: RecordType;
  label: string;
  emoji: string;
}

const OCR_PRESETS: OcrPreset[] = [
  { type: 'Lab Result', label: 'Lab Report', emoji: '🧪' },
  { type: 'Prescription', label: 'Prescription', emoji: '💊' },
  { type: 'Immunization', label: 'Vaccine Card', emoji: '💉' },
  { type: 'Imaging', label: 'Radiology Scan', emoji: '🩻' },
  { type: 'Receipt', label: 'Medical Receipt', emoji: '🧾' },
  { type: 'Clinical Note', label: 'Clinical Note', emoji: '📋' },
];

export function UploadModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [scanAnim] = useState(() => new Animated.Value(0));
  const [pickedFile, setPickedFile] = useState<PickedMediaResult | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<OcrPreset>(OCR_PRESETS[0]);
  const [targetMemberId, setTargetMemberId] = useState<string>(state.activeFamilyId || 'me');
  const [flashEnabled, setFlashEnabled] = useState(false);

  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Editable fields on Step 2
  const [editedTitle, setEditedTitle] = useState('');
  const [editedProvider, setEditedProvider] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedKeyValues, setEditedKeyValues] = useState<Array<{ label: string; value: string }>>([]);

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
    setOcrError(null);
    const result = await pickImageFromCamera(false);
    if (!result?.uri) return;
    setPickedFile(result);
    actions.setUploadStepScanning(); // patches uploadStep: 1

    try {
      const extracted = await ocrService.extractFromImage(result.uri, preset.type);
      if (extracted.success) {
        setOcrResult(extracted);
        setEditedTitle(extracted.title || `Scanned ${preset.label}`);
        setEditedProvider(extracted.provider || '');
        setEditedSummary(extracted.summary || '');
        setEditedKeyValues(extracted.keyValues || []);
        actions.setUploadStepReview(); // patches uploadStep: 2
      } else {
        setOcrError(extracted.message || 'Could not read this document.');
        actions.openUpload(); // back to step 0 with error shown
      }
    } catch {
      setOcrError('Document scanning failed. You can still add this record manually.');
      actions.openUpload();
    }
  };

  const handleUploadFiles = async (preset: OcrPreset) => {
    hapticFeedback.light();
    setSelectedPreset(preset);
    setOcrError(null);
    const result = await pickDocument();
    if (!result?.uri) return;
    setPickedFile(result);
    actions.setUploadStepScanning();

    try {
      const extracted = await ocrService.extractFromImage(result.uri, preset.type);
      if (extracted.success) {
        setOcrResult(extracted);
        setEditedTitle(extracted.title || result.name?.replace(/\.[^/.]+$/, '') || `Scanned ${preset.label}`);
        setEditedProvider(extracted.provider || '');
        setEditedSummary(extracted.summary || '');
        setEditedKeyValues(extracted.keyValues || []);
        actions.setUploadStepReview();
      } else {
        setOcrError(extracted.message || 'Could not read this document.');
        actions.openUpload();
      }
    } catch {
      setOcrError('Document scanning failed. You can still add this record manually.');
      actions.openUpload();
    }
  };

  const handleSaveToVault = () => {
    hapticFeedback.success();
    const finalTitle = editedTitle.trim() || ocrResult?.title || pickedFile?.name?.replace(/\.[^/.]+$/, '') || `Scanned ${selectedPreset.label}`;
    const finalProvider = editedProvider.trim() || ocrResult?.provider || 'Not detected — edit to add';
    const finalSummary = editedSummary.trim() || ocrResult?.summary || '';
    const finalKeyValues = editedKeyValues.filter((kv) => kv.label.trim() || kv.value.trim());

    actions.addRecord({
      ownerId: targetMemberId,
      title: finalTitle,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      type: selectedPreset.type,
      provider: finalProvider,
      summary: finalSummary,
      extractedOcr: {
        keyValues: finalKeyValues,
        statusBadge: finalKeyValues.length ? 'OCR Extracted' : 'Manual Entry Needed',
      },
    });

    setPickedFile(null);
    setOcrResult(null);
    setOcrError(null);
    actions.closeUpload();
  };

  const handleAddKeyValue = () => {
    hapticFeedback.selection();
    setEditedKeyValues([...editedKeyValues, { label: '', value: '' }]);
  };

  const handleUpdateKeyValue = (index: number, field: 'label' | 'value', text: string) => {
    const updated = [...editedKeyValues];
    updated[index] = { ...updated[index], [field]: text };
    setEditedKeyValues(updated);
  };

  const handleRemoveKeyValue = (index: number) => {
    hapticFeedback.light();
    setEditedKeyValues(editedKeyValues.filter((_, i) => i !== index));
  };

  const currentMember = state.familyMembers.find((f) => f.id === targetMemberId) || state.familyMembers[0];

  return (
    <Modal
      visible={state.showUpload}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        setPickedFile(null);
        setOcrError(null);
        actions.closeUpload();
      }}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={state.uploadStep === 1 ? 'OCR Document Scanner' : state.uploadStep === 2 ? 'Scanned Summary' : 'Add Health Record'}
          onClose={() => {
            setPickedFile(null);
            setOcrError(null);
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
                  setOcrError(null);
                  actions.closeUpload();
                }
          }
        />

        {/* STEP 0: Capture & Category Selection */}
        {state.uploadStep === 0 && (
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {/* Dismissible OCR Error Banner */}
            {ocrError && (
              <View style={styles.errorBanner}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={styles.errorBannerText}>{ocrError}</Text>
                <TouchableOpacity
                  onPress={() => setOcrError(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.errorDismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

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
                    <Text style={styles.docPlaceholderTitle}>{selectedPreset.label}</Text>
                    <Text style={styles.docPlaceholderSub}>Analyzing document text...</Text>
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
                  Analyzing headers, clinical fields, and lab reference ranges
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
              <Text style={styles.successTitle}>Document Digitized</Text>
              <Text style={styles.successSub}>
                Review or edit the extracted details before saving to {currentMember.name}'s vault:
              </Text>
            </View>

            {/* Extracted Clinical Metadata Card with Inline Editing */}
            <View style={styles.ocrResultCard}>
              <View style={styles.ocrHeaderRow}>
                <Text style={styles.ocrBadgeEmoji}>{selectedPreset.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabelSmall}>DOCUMENT TITLE</Text>
                  <TextInput
                    value={editedTitle}
                    onChangeText={setEditedTitle}
                    placeholder="Document title"
                    placeholderTextColor="#94a3b8"
                    style={styles.inlineTitleInput}
                  />
                </View>
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>
                    {editedKeyValues.length ? '✓ OCR Extracted' : 'Manual Review'}
                  </Text>
                </View>
              </View>

              <View style={styles.ocrDivider} />

              <Text style={styles.inputLabelSmall}>HEALTHCARE PROVIDER / FACILITY</Text>
              <TextInput
                value={editedProvider}
                onChangeText={setEditedProvider}
                placeholder="e.g. Central City Diagnostic Lab or Dr. Sarah Chen"
                placeholderTextColor="#94a3b8"
                style={styles.inlineTextInput}
              />

              <View style={styles.ocrDivider} />

              <View style={styles.sectionTitleRow}>
                <Text style={styles.ocrValuesHeader}>EXTRACTED CLINICAL VALUES</Text>
                <TouchableOpacity onPress={handleAddKeyValue} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.addFieldBtnText}>+ Add Field</Text>
                </TouchableOpacity>
              </View>

              {editedKeyValues.length === 0 ? (
                <View style={styles.emptyKvCard}>
                  <Text style={styles.emptyKvText}>
                    No structured key values detected. Tap "+ Add Field" to add lab values or test metrics manually.
                  </Text>
                </View>
              ) : (
                <View style={styles.keyValuesGrid}>
                  {editedKeyValues.map((kv, idx) => (
                    <View key={idx} style={styles.keyValueEditRow}>
                      <TextInput
                        value={kv.label}
                        onChangeText={(t) => handleUpdateKeyValue(idx, 'label', t)}
                        placeholder="Test / Field"
                        placeholderTextColor="#94a3b8"
                        style={styles.kvLabelInput}
                      />
                      <TextInput
                        value={kv.value}
                        onChangeText={(t) => handleUpdateKeyValue(idx, 'value', t)}
                        placeholder="Value / Result"
                        placeholderTextColor="#94a3b8"
                        style={styles.kvValueInput}
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveKeyValue(idx)}
                        style={styles.removeKvBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeKvBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.ocrDivider} />

              <Text style={styles.summaryLabel}>CLINICAL SUMMARY / NOTES</Text>
              <TextInput
                value={editedSummary}
                onChangeText={setEditedSummary}
                placeholder="Clinical observations, findings, dosage instructions, etc."
                placeholderTextColor="#94a3b8"
                multiline
                style={styles.summaryTextInput}
              />
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#991b1b',
    lineHeight: 17,
  },
  errorDismissText: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '700',
    paddingHorizontal: 4,
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
  inputLabelSmall: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inlineTitleInput: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  inlineTextInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
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
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ocrValuesHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  addFieldBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyKvCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyKvText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  keyValuesGrid: {
    gap: 8,
  },
  keyValueEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kvLabelInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  kvValueInput: {
    flex: 1.2,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  removeKvBtn: {
    padding: 6,
  },
  removeKvBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryTextInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    minHeight: 60,
    textAlignVertical: 'top',
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
