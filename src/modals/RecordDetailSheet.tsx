import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { RECORD_META } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function RecordDetailSheet({ app }: { app: WelliApp }) {
  const { state, actions, records, family } = app;
  const [activeTab, setActiveTab] = useState<'overview' | 'biomarkers'>('overview');

  const record = records.find((r) => r.id === state.recordDetailId);
  if (!record) return null;

  const patient = family.find((f) => f.id === record.ownerId) || family[0];
  const meta = RECORD_META[record.type];
  const isLabResult = record.type === 'Lab Result';
  const labDetails = record.labReportDetails;

  const handleWhatsAppShare = () => {
    hapticFeedback.success();
    actions.shareViaWhatsApp(record.id);
  };

  const handleEmailShare = () => {
    hapticFeedback.light();
    actions.openEmailLabResult(record.id);
  };

  const handlePrint = () => {
    hapticFeedback.light();
    actions.openPrintLabResult(record.id);
  };

  return (
    <Modal
      visible={!!state.recordDetailId}
      transparent
      animationType="slide"
      onRequestClose={actions.closeRecord}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={actions.closeRecord}
      >
        <TouchableOpacity
          style={styles.sheet}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.emojiBox, { backgroundColor: meta.tint }]}>
              <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordTitle} numberOfLines={2}>{record.title}</Text>
              <Text style={styles.recordSub}>
                {record.provider} · {record.date}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.closeRecord}
              style={styles.closeBtn}
              accessibilityLabel="Close record details"
            >
              <Svg width={14} height={14} viewBox="0 0 20 20">
                <Path
                  d="M4 4l12 12M16 4L4 16"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Segmented Tab (If Lab Result has detailed analytes) */}
          {isLabResult && labDetails?.biomarkers && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveTab('overview');
                }}
                style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
                  Overview & Findings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveTab('biomarkers');
                }}
                style={[styles.tabBtn, activeTab === 'biomarkers' && styles.tabBtnActive]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'biomarkers' && styles.tabBtnTextActive]}>
                  Lab Analytes ({labDetails.biomarkers.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Prescription Refill Action Banner */}
            {record.type === 'Prescription' && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  hapticFeedback.selection();
                  actions.openRefillModal('rx-1');
                }}
                style={styles.refillBanner}
              >
                <View style={styles.refillIconBox}>
                  <Text style={{ fontSize: 20 }}>💊</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.refillBannerTitle}>Order Medication Refill</Text>
                  <Text style={styles.refillBannerSub}>HMO 80% Co-Pay · Doorstep Lagos Dispatch</Text>
                </View>
                <View style={styles.refillPill}>
                  <Text style={styles.refillPillText}>Refill ›</Text>
                </View>
              </TouchableOpacity>
            )}

            {activeTab === 'overview' ? (
              <>
                {/* Clinical Summary Box */}
                <View style={styles.summaryBox}>
                  <Text style={styles.summarySectionLabel}>CLINICAL SUMMARY</Text>
                  <Text style={styles.summaryText}>{record.summary}</Text>
                </View>

                {/* Key Biomarkers / OCR Highlights */}
                {record.extractedOcr?.keyValues && record.extractedOcr.keyValues.length > 0 && (
                  <View style={styles.keyValuesCard}>
                    <Text style={styles.summarySectionLabel}>EXTRACTED CLINICAL VALUES</Text>
                    <View style={styles.kvGrid}>
                      {record.extractedOcr.keyValues.map((kv) => (
                        <View key={kv.label} style={styles.kvItem}>
                          <Text style={styles.kvLabel}>{kv.label}</Text>
                          <Text style={styles.kvValue}>{kv.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Patient & Provider Verification Card */}
                <View style={styles.verificationCard}>
                  <View style={styles.verifRow}>
                    <Text style={styles.verifLabel}>Patient Vault</Text>
                    <Text style={styles.verifVal}>{patient.name} ({patient.gender}, {patient.bloodType})</Text>
                  </View>
                  <View style={styles.verifRow}>
                    <Text style={styles.verifLabel}>HMO Coverage</Text>
                    <Text style={styles.verifVal}>{patient.insuranceProvider}</Text>
                  </View>
                  <View style={styles.verifRow}>
                    <Text style={styles.verifLabel}>Integrity Status</Text>
                    <Text style={styles.verifValGreen}>✓ NDPR Encrypted & Verified</Text>
                  </View>
                </View>
              </>
            ) : (
              /* Detailed Biomarkers Table */
              <View style={styles.biomarkersContainer}>
                <View style={styles.bioTableHeader}>
                  <Text style={[styles.bioTh, { flex: 2 }]}>ANALYTE</Text>
                  <Text style={[styles.bioTh, { flex: 1.2, textAlign: 'center' }]}>RESULT</Text>
                  <Text style={[styles.bioTh, { flex: 1.2, textAlign: 'right' }]}>REF LIMIT</Text>
                </View>

                {labDetails?.biomarkers.map((bm, index) => {
                  const isOptimal = bm.status === 'optimal' || bm.status === 'normal';
                  return (
                    <View
                      key={bm.analyte}
                      style={[
                        styles.bioTableRow,
                        { backgroundColor: index % 2 === 1 ? '#f8fafc' : '#ffffff' },
                      ]}
                    >
                      <View style={{ flex: 2 }}>
                        <Text style={styles.bioAnalyteName}>{bm.analyte}</Text>
                      </View>
                      <View style={{ flex: 1.2, alignItems: 'center' }}>
                        <Text style={styles.bioResultText}>
                          {bm.result} {bm.unit ? <Text style={styles.bioUnitText}>{bm.unit}</Text> : null}
                        </Text>
                        <Text style={[styles.bioStatusTag, isOptimal ? styles.statusOptimal : styles.statusFlagged]}>
                          {isOptimal ? '● Normal' : '▲ Flagged'}
                        </Text>
                      </View>
                      <Text style={[styles.bioRefText, { flex: 1.2, textAlign: 'right' }]}>
                        {bm.referenceInterval}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.pathologistCard}>
                  <Text style={styles.pathLabel}>CERTIFIED PATHOLOGIST SIGN-OFF</Text>
                  <Text style={styles.pathName}>{labDetails?.pathologist || 'Dr. Chinedu Okafor (MBBS, FMCPath)'}</Text>
                  <Text style={styles.pathLic}>License: {labDetails?.labLicenseNo || 'MLCN-LAB-88201'}</Text>
                </View>
              </View>
            )}

            {/* External Sharing & Print Hub */}
            <Text style={styles.shareHubTitle}>SHARE & EXPORT OPTIONS</Text>
            <View style={styles.shareOptionsGrid}>
              {/* WhatsApp Share Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleWhatsAppShare}
                style={styles.whatsAppBtn}
              >
                <View style={styles.whatsAppIconCircle}>
                  <Text style={{ fontSize: 16 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.whatsAppTitle}>Share on WhatsApp</Text>
                  <Text style={styles.whatsAppSub}>Encrypted summary & link</Text>
                </View>
                <Text style={styles.arrowChevronGreen}>›</Text>
              </TouchableOpacity>

              {/* Email PDF Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleEmailShare}
                style={styles.emailBtn}
              >
                <View style={styles.emailIconCircle}>
                  <Text style={{ fontSize: 16 }}>✉️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emailTitle}>Send via Email</Text>
                  <Text style={styles.emailSub}>Certified PDF attachment</Text>
                </View>
                <Text style={styles.arrowChevronBlue}>›</Text>
              </TouchableOpacity>

              {/* Print Official Result Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePrint}
                style={styles.printOptionBtn}
              >
                <View style={styles.printIconCircle}>
                  <Text style={{ fontSize: 16 }}>🖨️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.printTitle}>Print Official Lab Report</Text>
                  <Text style={styles.printSub}>Hospital letterhead & QR seal</Text>
                </View>
                <Text style={styles.arrowChevronDark}>›</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Primary In-App Sharing CTA & Download Footer */}
          <View style={styles.footerActionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => actions.shareThisRecord(record.id)}
              style={styles.primaryShareBtn}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={6} cy={12} r={2.6} stroke="#ffffff" strokeWidth={2} />
                <Circle cx={17} cy={6} r={2.6} stroke="#ffffff" strokeWidth={2} />
                <Circle cx={17} cy={18} r={2.6} stroke="#ffffff" strokeWidth={2} />
                <Path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" stroke="#ffffff" strokeWidth={1.8} />
              </Svg>
              <Text style={styles.primaryShareBtnText}>Clinical Consent Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.downloadRecord}
              style={styles.downloadBtn}
              accessibilityLabel="Download record to device"
            >
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Path
                  d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12"
                  stroke="#334155"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  recordSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#041E42',
    fontWeight: '800',
  },
  contentScroll: {
    maxHeight: 380,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summarySectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  keyValuesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kvGrid: {
    gap: 6,
  },
  kvItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  kvValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  verificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 6,
  },
  verifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  verifLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  verifVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  verifValGreen: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  biomarkersContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  bioTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  bioTh: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  bioTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  bioAnalyteName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1e293b',
  },
  bioResultText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  bioUnitText: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748b',
  },
  bioStatusTag: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  statusOptimal: {
    color: '#059669',
  },
  statusFlagged: {
    color: '#dc2626',
  },
  bioRefText: {
    fontSize: 11,
    color: '#64748b',
  },
  pathologistCard: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pathLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  pathName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  pathLic: {
    fontSize: 10,
    color: '#64748b',
  },
  shareHubTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  shareOptionsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  whatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  whatsAppIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#166534',
  },
  whatsAppSub: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
  },
  arrowChevronGreen: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  emailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#075985',
  },
  emailSub: {
    fontSize: 11,
    color: '#0369a1',
    marginTop: 1,
  },
  arrowChevronBlue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
  },
  printOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  printIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#041E42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  printSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  arrowChevronDark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  footerActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryShareBtn: {
    flex: 1,
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryShareBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  downloadBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  refillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 14,
  },
  refillIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refillBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065f46',
  },
  refillBannerSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  refillPill: {
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  refillPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
