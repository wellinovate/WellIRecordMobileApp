import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { Row, SectionLabel, ToggleRow } from '../components/SettingsUI';
import type { WelliApp } from '../state/useWelliApp';

export function PrivacySecurityModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showPrivacySecurity) return null;

  const deviceName =
    Platform.OS === 'ios'
      ? 'iPhone (iOS)'
      : Platform.OS === 'android'
      ? 'Android Device'
      : 'Web Browser';
  const deviceEmoji = Platform.OS === 'web' ? '💻' : '📱';

  return (
    <Modal
      visible={state.showPrivacySecurity}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closePrivacySecurity}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Privacy & Security"
          onClose={actions.closePrivacySecurity}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <View style={styles.encryptedBanner}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                stroke="#1a6b42"
                strokeWidth={1.8}
              />
            </Svg>
            <Text style={styles.encryptedText}>
              All records are encrypted at rest and in transit.
            </Text>
          </View>

          <SectionLabel>Security</SectionLabel>
          <View style={styles.cardBox}>
            <ToggleRow
              emoji="🔒"
              label="Biometric Lock"
              sub="Require Face ID / Touch ID to unlock"
              on={state.faceIdEnabled}
              onClick={actions.toggleFaceId}
            />
            <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
              <ToggleRow
                emoji="🔑"
                label="Two-Factor Authentication"
                sub="Require SMS / Email OTP when signing in"
                on={state.twoFactorEnabled}
                onClick={actions.toggleTwoFactor}
              />
            </View>
          </View>

          <SectionLabel>Active Sessions</SectionLabel>
          <View style={styles.sessionCard}>
            <View style={styles.deviceEmoji}>
              <Text style={{ fontSize: 16 }}>{deviceEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{deviceName}</Text>
              <Text style={styles.deviceLocation}>
                This device · Active now
              </Text>
            </View>
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          </View>

          <SectionLabel>Data Portability & Backup</SectionLabel>
          <View style={styles.cardBox}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Row
                emoji="📦"
                label="Export Encrypted Vault Backup (.welli / PDF)"
                onClick={actions.openVaultExport}
              />
            </View>
            <Row
              emoji="📄"
              label="Privacy Policy"
              onClick={actions.openPrivacyPolicy}
            />
          </View>

          <View style={[styles.cardBox, { borderColor: '#fca5a5' }]}>
            <Row
              emoji="🗑️"
              label="Delete Account"
              onClick={actions.requestAccountDeletion}
              danger
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  encryptedBanner: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  encryptedText: {
    fontSize: 12.5,
    color: '#64748b',
    flex: 1,
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 22,
  },
  sessionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  deviceEmoji: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  deviceLocation: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  currentBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
});
