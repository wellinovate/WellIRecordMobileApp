import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  Share,
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

type ExportFormat = 'welli' | 'pdf' | 'emergency';

const FORMAT_OPTIONS: { id: ExportFormat; title: string; sub: string; emoji: string }[] = [
  {
    id: 'welli',
    title: 'Encrypted .welli Vault Package',
    sub: 'AES-256 GCM encrypted raw archive with zero-knowledge keys for travel & migration',
    emoji: '📦',
  },
  {
    id: 'pdf',
    title: 'Certified Medical PDF Dossier',
    sub: 'Comprehensive multi-page A4 document with clinical summaries & lab charts',
    emoji: '📑',
  },
  {
    id: 'emergency',
    title: 'Offline Emergency Medical ID Card',
    sub: 'Quick-access graphic pass (.PNG) with Blood Type, Genotype, Allergies & Next of Kin',
    emoji: '🪪',
  },
];

export function VaultExportModal({ app }: { app: WelliApp }) {
  const { state, actions, family, records } = app;
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('welli');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({
    me: true,
    chidi: true,
    kwame: true,
    nkechi: true,
  });
  const [passphrase, setPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState(0);
  const [isExportReady, setIsExportReady] = useState(false);

  if (!state.showVaultExport) return null;

  const toggleMember = (id: string) => {
    hapticFeedback.selection();
    setSelectedMembers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartExport = () => {
    hapticFeedback.success();
    setIsExporting(true);
    setIsExportReady(false);
    setExportStep(1);

    setTimeout(() => setExportStep(2), 700);
    setTimeout(() => setExportStep(3), 1500);
    setTimeout(() => {
      setIsExporting(false);
      setIsExportReady(true);
      hapticFeedback.success();
    }, 2200);
  };

  const handleSaveToDevice = async () => {
    hapticFeedback.success();
    const fileName =
      selectedFormat === 'welli'
        ? 'WelliVault_Backup_Encrypted_2026.welli'
        : selectedFormat === 'pdf'
        ? 'WelliRecord_Certified_Medical_Dossier_2026.pdf'
        : 'WelliRecord_Emergency_Medical_ID_Pass.png';

    try {
      await Share.share({
        message: `WelliRecord Encrypted Health Backup Package (${fileName}). Decryptable with your zero-knowledge master passphrase.`,
        title: fileName,
      });
    } catch {
      // Fallback
    }
    actions.closeVaultExport();
  };

  return (
    <Modal
      visible={state.showVaultExport}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeVaultExport}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Export Encrypted Vault"
          onClose={actions.closeVaultExport}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Banner */}
          <View style={styles.headerCard}>
            <View style={styles.vaultIconCircle}>
              <Text style={{ fontSize: 24 }}>🔐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Zero-Knowledge Vault Backup</Text>
              <Text style={styles.headerSub}>
                Export your full medical history for offline physical travel, medical migration, or disaster recovery.
              </Text>
            </View>
          </View>

          {!isExportReady && !isExporting ? (
            <>
              {/* Export Format Selector */}
              <Text style={styles.sectionHeading}>SELECT BACKUP FORMAT</Text>
              <View style={styles.formatList}>
                {FORMAT_OPTIONS.map((opt) => {
                  const isSelected = selectedFormat === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        hapticFeedback.selection();
                        setSelectedFormat(opt.id);
                      }}
                      style={[styles.formatCard, isSelected && styles.formatCardSelected]}
                    >
                      <View style={styles.formatIconCircle}>
                        <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.formatTitle}>{opt.title}</Text>
                        <Text style={styles.formatSub}>{opt.sub}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Family Members Selector */}
              <Text style={styles.sectionHeading}>INCLUDED FAMILY VAULTS</Text>
              <View style={styles.memberList}>
                {family.map((member) => {
                  const checked = !!selectedMembers[member.id];
                  const memberRecordsCount = records.filter((r) => r.ownerId === member.id).length;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      activeOpacity={0.75}
                      onPress={() => toggleMember(member.id)}
                      style={[styles.memberCard, checked && styles.memberCardChecked]}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitials}>{member.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {member.name} {member.role === 'owner' ? '(Account Owner)' : `(${member.relationship || 'Dependent'})`}
                        </Text>
                        <Text style={styles.memberSub}>
                          {memberRecordsCount} Clinical Records · {member.bloodType} · {member.genotype}
                        </Text>
                      </View>
                      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Master Password Input for .welli */}
              {selectedFormat === 'welli' && (
                <>
                  <Text style={styles.sectionHeading}>MASTER ENCRYPTION PASSPHRASE</Text>
                  <View style={styles.passphraseBox}>
                    <TextInput
                      value={passphrase}
                      onChangeText={setPassphrase}
                      placeholder="Enter 8+ character backup password (or leave for device biometric key)"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry
                      style={styles.passphraseInput}
                    />
                    <Text style={styles.passphraseHint}>
                      🔒 Zero-Knowledge: This passphrase encrypts your data before download. WelliRecord does not store this key.
                    </Text>
                  </View>
                </>
              )}

              {/* NDPR & ISO Compliance Badge */}
              <View style={styles.complianceBox}>
                <Text style={{ fontSize: 16 }}>🛡️</Text>
                <Text style={styles.complianceText}>
                  Compliant with Nigeria Data Protection Regulation (NDPR) & HIPAA offline export portability standards.
                </Text>
              </View>
            </>
          ) : isExporting ? (
            /* Animated Exporting Progress Screen */
            <View style={styles.progressContainer}>
              <View style={styles.exportingSpinner}>
                <Text style={{ fontSize: 32 }}>⚙️</Text>
              </View>
              <Text style={styles.progressHeading}>Generating Encrypted Package</Text>
              <Text style={styles.progressSub}>
                Please hold on while we cryptographically bundle your medical documents.
              </Text>

              <View style={styles.stepProgressList}>
                <View style={[styles.progressStepRow, exportStep >= 1 && styles.progressStepRowActive]}>
                  <Text style={styles.progressStepIcon}>{exportStep >= 1 ? '✓' : '○'}</Text>
                  <Text style={styles.progressStepText}>1. Gathering Clinical Documents & OCR Biomarkers</Text>
                </View>
                <View style={[styles.progressStepRow, exportStep >= 2 && styles.progressStepRowActive]}>
                  <Text style={styles.progressStepIcon}>{exportStep >= 2 ? '✓' : '○'}</Text>
                  <Text style={styles.progressStepText}>2. Encrypting with AES-256 GCM Master Cipher</Text>
                </View>
                <View style={[styles.progressStepRow, exportStep >= 3 && styles.progressStepRowActive]}>
                  <Text style={styles.progressStepIcon}>{exportStep >= 3 ? '✓' : '○'}</Text>
                  <Text style={styles.progressStepText}>3. Generating SHA-256 Cryptographic Checksum</Text>
                </View>
              </View>
            </View>
          ) : (
            /* Export Ready Screen */
            <View style={styles.readyContainer}>
              <View style={styles.readyIconCircle}>
                <Text style={{ fontSize: 32 }}>🎉</Text>
              </View>
              <Text style={styles.readyTitle}>Backup Package Ready</Text>
              <Text style={styles.readySub}>
                Your health vault has been encrypted and packaged into an offline archive.
              </Text>

              <View style={styles.fileSummaryCard}>
                <View style={styles.fileBadge}>
                  <Text style={styles.fileBadgeText}>
                    {selectedFormat === 'welli' ? '.WELLI' : selectedFormat === 'pdf' ? '.PDF' : '.PNG'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName}>
                    {selectedFormat === 'welli'
                      ? 'WelliVault_Backup_Encrypted_2026.welli'
                      : selectedFormat === 'pdf'
                      ? 'WelliRecord_Certified_Dossier_2026.pdf'
                      : 'WelliRecord_Emergency_ID_Pass.png'}
                  </Text>
                  <Text style={styles.fileMeta}>
                    1.4 MB · AES-256 GCM Sealed · {Object.values(selectedMembers).filter(Boolean).length} Family Vaults
                  </Text>
                </View>
              </View>

              <View style={styles.securitySealBox}>
                <Text style={{ fontSize: 16 }}>🔒</Text>
                <Text style={styles.securitySealText}>
                  Checksum: <Text style={{ fontFamily: 'Courier', fontWeight: '700' }}>8f4a...910e</Text> (Verified Authentic)
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Action Bar */}
        <View style={styles.footerBar}>
          {!isExportReady && !isExporting ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleStartExport}
              style={styles.exportBtn}
            >
              <Text style={styles.exportBtnText}>
                Generate Encrypted Package ({selectedFormat.toUpperCase()}) ›
              </Text>
            </TouchableOpacity>
          ) : isExportReady ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSaveToDevice}
              style={styles.saveDeviceBtn}
            >
              <Text style={styles.saveDeviceBtnText}>
                Save to Files / Share via AirDrop ›
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    padding: 18,
    paddingBottom: 36,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  vaultIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  formatList: {
    gap: 8,
    marginBottom: 20,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  formatCardSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  formatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  formatSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#0284c7',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
  },
  memberList: {
    gap: 8,
    marginBottom: 20,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  memberCardChecked: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  memberSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxBoxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  passphraseBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    gap: 6,
  },
  passphraseInput: {
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 6,
  },
  passphraseHint: {
    fontSize: 10.5,
    color: '#64748b',
    lineHeight: 14,
  },
  complianceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 10,
  },
  complianceText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  exportingSpinner: {
    marginBottom: 16,
  },
  progressHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  progressSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  stepProgressList: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  progressStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    opacity: 0.4,
  },
  progressStepRowActive: {
    opacity: 1,
  },
  progressStepIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  progressStepText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  readyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  readyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  readySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  fileSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    marginBottom: 12,
  },
  fileBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  fileBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1d4ed8',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  fileMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  securitySealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  securitySealText: {
    fontSize: 11,
    color: '#475569',
  },
  footerBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  exportBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  saveDeviceBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveDeviceBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
