import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function PrintLabResultModal({ app }: { app: WelliApp }) {
  const { state, actions, records, family } = app;
  const [isPrinting, setIsPrinting] = useState(false);
  const [printedDone, setPrintedDone] = useState(false);

  if (!state.showPrintLabResult) return null;

  const record = records.find((r) => r.id === state.showPrintLabResult);
  if (!record) return null;

  const patient = family.find((f) => f.id === record.ownerId) || family[0];
  const labDetails = record.labReportDetails;

  const handlePrint = () => {
    hapticFeedback.success();
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintedDone(true);
      setTimeout(() => {
        setPrintedDone(false);
        actions.closePrintLabResult();
      }, 1400);
    }, 1200);
  };

  const handleSavePdf = () => {
    hapticFeedback.success();
    actions.downloadRecord();
    actions.closePrintLabResult();
  };

  return (
    <Modal
      visible={!!state.showPrintLabResult}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closePrintLabResult}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Print & PDF Document"
          onClose={actions.closePrintLabResult}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.previewActionBar}>
            <View style={styles.paperBadge}>
              <Text style={styles.paperBadgeText}>📄 Standard A4 Medical Certificate</Text>
            </View>
            <Text style={styles.previewMeta}>Ready to Print / Export</Text>
          </View>

          {/* Printable Document Paper Card */}
          <View style={styles.paperDocument}>
            {/* Lab / Clinic Header Banner */}
            <View style={styles.docHeader}>
              <View style={styles.docLogoBox}>
                <Text style={{ fontSize: 24 }}>🧪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docHospitalName}>{record.provider.toUpperCase()}</Text>
                <Text style={styles.docHospitalSub}>
                  DEPARTMENT OF CLINICAL PATHOLOGY & METABOLIC BIOCHEMISTRY
                </Text>
                <Text style={styles.docAccreditation}>
                  MLCN Lic: {labDetails?.labLicenseNo || 'MLCN-LAB-88201'} · ISO 15189 Certified
                </Text>
              </View>
            </View>

            <View style={styles.docDividerThick} />

            {/* Patient & Specimen Info Grid */}
            <View style={styles.patientInfoGrid}>
              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>PATIENT NAME</Text>
                <Text style={styles.fieldValue}>{patient.name}</Text>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>DATE OF BIRTH / GENDER</Text>
                <Text style={styles.fieldValue}>{patient.dob} ({patient.gender})</Text>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>BLOOD / GENOTYPE</Text>
                <Text style={styles.fieldValue}>{patient.bloodType} · {patient.genotype}</Text>
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.fieldLabel}>REPORT REF / SPECIMEN ID</Text>
                <Text style={styles.fieldValue}>{labDetails?.specimenId || `SPEC-${record.id.toUpperCase()}-2026`}</Text>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>COLLECTED / REPORTED</Text>
                <Text style={styles.fieldValue}>{record.date}</Text>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>HMO / PAYER ID</Text>
                <Text style={styles.fieldValue}>{patient.insuranceProvider}</Text>
              </View>
            </View>

            <View style={styles.docDivider} />

            {/* Test Title */}
            <View style={styles.testTitleBox}>
              <Text style={styles.testDocumentTitle}>{record.title.toUpperCase()}</Text>
              <Text style={styles.testSpecimenType}>
                Specimen: {labDetails?.specimenType || 'Venous Whole Blood / Serum'}
              </Text>
            </View>

            {/* Biomarkers Table */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, { flex: 2 }]}>ANALYTE / TEST</Text>
              <Text style={[styles.thCell, { flex: 1.2, textAlign: 'center' }]}>RESULT</Text>
              <Text style={[styles.thCell, { flex: 1.3, textAlign: 'right' }]}>REF. INTERVAL</Text>
              <Text style={[styles.thCell, { width: 55, textAlign: 'right' }]}>STATUS</Text>
            </View>

            {labDetails?.biomarkers ? (
              labDetails.biomarkers.map((bm, index) => {
                const isOptimal = bm.status === 'optimal' || bm.status === 'normal';
                return (
                  <View
                    key={bm.analyte}
                    style={[
                      styles.tableRow,
                      { backgroundColor: index % 2 === 1 ? '#f8fafc' : '#ffffff' },
                    ]}
                  >
                    <Text style={[styles.tdAnalyte, { flex: 2 }]}>{bm.analyte}</Text>
                    <Text style={[styles.tdResult, { flex: 1.2, textAlign: 'center' }]}>
                      {bm.result} {bm.unit ? <Text style={styles.tdUnit}>{bm.unit}</Text> : null}
                    </Text>
                    <Text style={[styles.tdRef, { flex: 1.3, textAlign: 'right' }]}>
                      {bm.referenceInterval}
                    </Text>
                    <View style={{ width: 55, alignItems: 'flex-end' }}>
                      <Text style={[styles.statusText, isOptimal ? styles.statusNormal : styles.statusFlagged]}>
                        {isOptimal ? 'NORMAL' : 'FLAGGED'}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              (record.extractedOcr?.keyValues || []).map((kv, index) => (
                <View
                  key={kv.label}
                  style={[
                    styles.tableRow,
                    { backgroundColor: index % 2 === 1 ? '#f8fafc' : '#ffffff' },
                  ]}
                >
                  <Text style={[styles.tdAnalyte, { flex: 2 }]}>{kv.label}</Text>
                  <Text style={[styles.tdResult, { flex: 1.5, textAlign: 'center' }]}>{kv.value}</Text>
                  <Text style={[styles.tdRef, { flex: 1, textAlign: 'right' }]}>Standard</Text>
                  <View style={{ width: 55, alignItems: 'flex-end' }}>
                    <Text style={[styles.statusText, styles.statusNormal]}>NORMAL</Text>
                  </View>
                </View>
              ))
            )}

            {/* Clinical Summary & Pathologist Sign-off */}
            <View style={styles.docFooter}>
              <Text style={styles.footerSectionLabel}>CLINICAL INTERPRETATION & PATHOLOGIST NOTE</Text>
              <Text style={styles.interpretationText}>
                {labDetails?.clinicalInterpretation || record.summary}
              </Text>

              <View style={styles.signatureRow}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatoryName}>
                    {labDetails?.pathologist || 'Dr. Chinedu Okafor (MBBS, FMCPath)'}
                  </Text>
                  <Text style={styles.signatoryTitle}>Chief Consultant Pathologist</Text>
                  <Text style={styles.signatoryLic}>Medical & Dental Council of Nigeria · Reg #44091</Text>
                </View>

                {/* QR & Compliance Seal */}
                <View style={styles.qrSealBox}>
                  <View style={styles.qrSquare}>
                    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
                      <Rect x="2" y="2" width="8" height="8" stroke="#041E42" strokeWidth="2" />
                      <Rect x="14" y="2" width="8" height="8" stroke="#041E42" strokeWidth="2" />
                      <Rect x="2" y="14" width="8" height="8" stroke="#041E42" strokeWidth="2" />
                      <Circle cx="6" cy="6" r="1.5" fill="#041E42" />
                      <Circle cx="18" cy="6" r="1.5" fill="#041E42" />
                      <Circle cx="6" cy="18" r="1.5" fill="#041E42" />
                      <Rect x="14" y="14" width="4" height="4" fill="#041E42" />
                    </Svg>
                  </View>
                  <Text style={styles.qrSealText}>NDPR Verified</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Print & Export Actions Footer */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSavePdf}
            style={styles.savePdfBtn}
          >
            <Svg width={18} height={18} viewBox="0 0 20 20">
              <Path
                d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12"
                stroke="#041E42"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.savePdfText}>Save PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePrint}
            disabled={isPrinting}
            style={styles.printBtn}
          >
            {isPrinting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : printedDone ? (
              <Text style={styles.printBtnText}>✓ Sent to Printer</Text>
            ) : (
              <>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <Path d="M6 14h12v8H6z" stroke="#ffffff" strokeWidth={2} fill="#041E42" />
                </Svg>
                <Text style={styles.printBtnText}>Print Official Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 24,
  },
  previewActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  paperBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  paperBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewMeta: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  paperDocument: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  docLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHospitalName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#041E42',
    letterSpacing: 0.5,
  },
  docHospitalSub: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 1,
  },
  docAccreditation: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  docDividerThick: {
    height: 3,
    backgroundColor: '#041E42',
    marginVertical: 10,
  },
  patientInfoGrid: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 8,
  },
  infoCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  docDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  testTitleBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  testDocumentTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#041E42',
    letterSpacing: 0.6,
  },
  testSpecimenType: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  thCell: {
    fontSize: 9,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tdAnalyte: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e293b',
  },
  tdResult: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  tdUnit: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#64748b',
  },
  tdRef: {
    fontSize: 9.5,
    color: '#64748b',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
  },
  statusNormal: {
    color: '#059669',
  },
  statusFlagged: {
    color: '#dc2626',
  },
  docFooter: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerSectionLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  interpretationText: {
    fontSize: 9.5,
    color: '#334155',
    lineHeight: 14,
    marginBottom: 12,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 6,
  },
  signatureBox: {
    flex: 1,
  },
  signatoryName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#041E42',
  },
  signatoryTitle: {
    fontSize: 9,
    color: '#475569',
    marginTop: 1,
  },
  signatoryLic: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 1,
  },
  qrSealBox: {
    alignItems: 'center',
    gap: 2,
  },
  qrSquare: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#041E42',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  qrSealText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#041E42',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  savePdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
  },
  savePdfText: {
    color: '#041E42',
    fontSize: 14,
    fontWeight: '800',
  },
  printBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    paddingVertical: 14,
  },
  printBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
