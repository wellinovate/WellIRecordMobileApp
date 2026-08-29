import React from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { EXPIRY_LABEL_MAP } from '../utils/expiry';
import type { WelliApp } from '../state/useWelliApp';
import type { ShareExpiry } from '../data/types';

const EXPIRY_DEFS: [ShareExpiry, string, string?][] = [
  ['24h', '24 Hours', 'Emergency'],
  ['7d', '7 Days', 'Suggested'],
  ['30d', '30 Days'],
  ['custom', '90 Days'],
];

function Tile({
  label,
  selected,
  onClick,
  badge,
  solid,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  solid?: boolean;
}) {
  return (
    <View style={styles.tileWrapper}>
      {badge ? (
        <View style={styles.tileBadge}>
          <Text style={styles.tileBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onClick}
        style={[
          styles.tile,
          {
            borderColor: selected ? '#10b981' : '#e2e8f0',
            backgroundColor: selected
              ? solid
                ? '#059669'
                : '#ecfdf5'
              : '#ffffff',
          },
        ]}
      >
        <Text
          style={[
            styles.tileText,
            {
              color: selected
                ? solid
                  ? '#ffffff'
                  : '#059669'
                : '#0f172a',
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function SmartConsentModal({ app }: { app: WelliApp }) {
  const { state, actions, consentScopes } = app;
  if (!state.showSmartConsent) return null;

  const isOrg = state.consentGranteeType === 'organization';

  return (
    <Modal
      visible={state.showSmartConsent}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeSmartConsent}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Smart Consent Controls"
          onClose={actions.closeSmartConsent}
          onBack={actions.closeSmartConsent}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <View style={styles.infoBanner}>
            <Text style={{ fontSize: 16 }}>🔗</Text>
            <Text style={styles.infoBannerText}>
              Grant access to a provider or organization.
            </Text>
          </View>

          <Text style={styles.sectionHeading}>Grantee Type</Text>
          <View style={styles.gridTwo}>
            <Tile
              label="Individual Provider"
              selected={!isOrg}
              onClick={() => actions.setConsentGranteeType('individual')}
            />
            <Tile
              label="Organization"
              selected={isOrg}
              onClick={() => actions.setConsentGranteeType('organization')}
            />
          </View>

          <Text style={styles.sectionHeading}>
            {isOrg ? 'Organization ID' : 'Provider User ID'}
          </Text>
          <TextInput
            value={state.consentProviderId}
            onChangeText={actions.setConsentProviderId}
            placeholder={isOrg ? 'Enter organization ID' : 'Enter provider user ID'}
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
          />

          <Text style={styles.sectionHeading}>Access Scope</Text>
          <View style={styles.gridTwo}>
            {consentScopes.map((scope) => (
              <Tile
                key={scope}
                label={scope}
                selected={state.consentScope === scope}
                onClick={() => actions.setConsentScope(scope)}
              />
            ))}
          </View>

          {/* Allow Write Access Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.toggleConsentWrite}
            style={styles.writeAccessCard}
          >
            <View
              style={[
                styles.writeCheckbox,
                {
                  borderColor: state.consentAllowWrite ? '#059669' : '#cbd5e1',
                  backgroundColor: state.consentAllowWrite ? '#059669' : '#ffffff',
                },
              ]}
            >
              {state.consentAllowWrite && (
                <Svg width={12} height={12} viewBox="0 0 20 20">
                  <Path
                    d="M4 10l4 4 8-9"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.writeTitle}>Allow write access</Text>
              <Text style={styles.writeSub}>
                This provider can add new records (e.g. lab orders, prescriptions) for you, not just view existing ones. Off by default.
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionHeading}>Auto-Expire Duration</Text>
          <View style={styles.gridTwo}>
            {EXPIRY_DEFS.map(([val, label, badge]) => (
              <Tile
                key={val}
                label={label}
                badge={badge}
                selected={state.consentExpiry === val}
                onClick={() => actions.setConsentExpiry(val)}
                solid
              />
            ))}
          </View>
          <Text style={styles.expireNotice}>
            Expires {EXPIRY_LABEL_MAP[state.consentExpiry]}.
          </Text>

          <Text style={styles.sectionHeading}>Purpose</Text>
          <TextInput
            value={state.consentPurpose}
            onChangeText={actions.setConsentPurpose}
            placeholder="Example: Second opinion, emergency treatment, lab review..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            style={[styles.textInput, styles.textArea]}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={actions.grantSmartAccess}
            style={styles.grantBtn}
          >
            <Text style={styles.grantBtnText}>Grant Access</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  infoBanner: {
    borderRadius: 12,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  infoBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a8a',
    flex: 1,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  tileWrapper: {
    width: '48%',
    position: 'relative',
  },
  tileBadge: {
    position: 'absolute',
    top: -7,
    right: 8,
    zIndex: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  tileBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  tile: {
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 20,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  writeAccessCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  writeCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  writeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  writeSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  expireNotice: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: -12,
    marginBottom: 20,
  },
  grantBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  grantBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
