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
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const EMAIL_PRESETS = [
  { label: 'Doctor / Clinic', email: 'referrals@riversideclinic.ng' },
  { label: 'HMO Claims Dept', email: 'claims@hygeiahmo.com' },
  { label: 'Self Backup', email: 'amara.nwosu@gmail.com' },
];

export function EmailReportModal({ app }: { app: WelliApp }) {
  const { state, actions, records, family } = app;
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalNote, setPersonalNote] = useState('');

  if (!state.showEmailLabResult) return null;

  const record = records.find((r) => r.id === state.showEmailLabResult);
  if (!record) return null;

  const patient = family.find((f) => f.id === record.ownerId) || family[0];
  const disabled = !recipientEmail.trim() || !recipientEmail.includes('@');

  const handleSend = () => {
    hapticFeedback.success();
    actions.sendEmailReport(record.id, recipientEmail.trim(), personalNote.trim());
  };

  return (
    <Modal
      visible={!!state.showEmailLabResult}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeEmailLabResult}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Email Lab Results"
          onClose={actions.closeEmailLabResult}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Banner */}
          <View style={styles.headerCard}>
            <View style={styles.mailIconCircle}>
              <Text style={{ fontSize: 22 }}>✉️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Send Encrypted PDF via Email</Text>
              <Text style={styles.headerSub}>
                Export certified lab test certificate for {patient.name}
              </Text>
            </View>
          </View>

          {/* Quick Recipient Presets */}
          <Text style={styles.sectionLabel}>QUICK RECIPIENTS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
            {EMAIL_PRESETS.map((preset) => {
              const isSelected = recipientEmail === preset.email;
              return (
                <TouchableOpacity
                  key={preset.label}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    setRecipientEmail(preset.email);
                  }}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                >
                  <Text style={[styles.presetChipLabel, isSelected && styles.presetChipLabelActive]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.presetChipEmail}>{preset.email}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Recipient Email Input */}
          <Text style={styles.sectionLabel}>RECIPIENT EMAIL ADDRESS</Text>
          <TextInput
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            placeholder="e.g. doctor@hospital.com or claims@hmo.com"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.textInput}
          />

          {/* Email Subject Preview */}
          <Text style={styles.sectionLabel}>EMAIL SUBJECT</Text>
          <View style={styles.subjectBox}>
            <Text style={styles.subjectText}>
              [WelliRecord] Certified Medical Lab Result: {record.title} · {patient.name}
            </Text>
          </View>

          {/* Optional Message / Note */}
          <Text style={styles.sectionLabel}>ADD CLINICAL NOTE / COVER MESSAGE (OPTIONAL)</Text>
          <TextInput
            value={personalNote}
            onChangeText={setPersonalNote}
            placeholder="e.g. Attached are my recent metabolic panel results for our follow-up review on Thursday."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            style={styles.textareaInput}
          />

          {/* PDF Attachment Card */}
          <Text style={styles.sectionLabel}>ATTACHED CERTIFIED DOCUMENT</Text>
          <View style={styles.attachmentCard}>
            <View style={styles.pdfBadge}>
              <Text style={styles.pdfBadgeText}>PDF</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentName}>
                {record.title.replace(/[^a-zA-Z0-9]/g, '_')}_Verified.pdf
              </Text>
              <Text style={styles.attachmentMeta}>
                {record.provider} · 245 KB · AES-256 Encrypted
              </Text>
            </View>
            <View style={styles.verifiedTag}>
              <Text style={styles.verifiedTagText}>✓ Signed</Text>
            </View>
          </View>

          {/* Privacy & NDPR Notice */}
          <View style={styles.privacyBox}>
            <Text style={{ fontSize: 16 }}>🛡️</Text>
            <Text style={styles.privacyText}>
              Transmitted securely via TLS 1.3 with cryptographic access tokens. The recipient will be granted access under NDPR data compliance rules.
            </Text>
          </View>
        </ScrollView>

        {/* Footer Send CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={disabled}
            style={[
              styles.sendBtn,
              { backgroundColor: disabled ? '#cbd5e1' : '#041E42' },
            ]}
          >
            <Text
              style={[
                styles.sendBtnText,
                { color: disabled ? '#64748b' : '#ffffff' },
              ]}
            >
              Send Encrypted PDF via Email ›
            </Text>
          </TouchableOpacity>
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
    paddingBottom: 32,
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
  mailIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  presetChipActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0284c7',
  },
  presetChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetChipLabelActive: {
    color: '#0284c7',
  },
  presetChipEmail: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13.5,
    color: '#0f172a',
    marginBottom: 18,
  },
  subjectBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  subjectText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  textareaInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  pdfBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#dc2626',
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  attachmentMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  verifiedTag: {
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 11.5,
    color: '#166534',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  sendBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
