import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function ShareScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, family } = app;

  const activeSharesView = state.activeShares.map((sh) => {
    const owner = family.find((f) => f.id === sh.ownerId) ?? family[0];
    return {
      ...sh,
      ownerLabel: owner.id === 'me' ? null : `For ${owner.name.split(' ')[0]}`,
    };
  });

  const handleCopyLink = (sh: any) => {
    hapticFeedback.selection();
    const pin = sh.id ? sh.id.replace(/\D/g, '').slice(-6) || '849201' : '849201';
    actions.showToast(`WelliBridge link & PIN (${pin}) copied to clipboard`);
  };

  const handleRevoke = (id: string, name: string) => {
    hapticFeedback.warning();
    Alert.alert(
      'Revoke Clinical Access?',
      `Are you sure you want to immediately revoke access for ${name}? They will no longer be able to view or download these records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Immediately',
          style: 'destructive',
          onPress: () => actions.revokeShare(id),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        {state.tabHistory.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.goBackTab}
            style={[
              styles.backBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Go back to previous page"
          >
            <Svg width={14} height={14} viewBox="0 0 20 20">
              <Path
                d="M12 4l-6 6 6 6"
                stroke={theme.text}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Share & Consent</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Time-bound encrypted access controlled entirely by you (NDPR Certified).
          </Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => actions.openShareFlow()}
          style={[styles.primaryActionBtn, { backgroundColor: '#041E42' }]}
        >
          <Svg width={18} height={18} viewBox="0 0 20 20">
            <Path
              d="M10 3v14M3 10h14"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.primaryActionText}>Share Records</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={actions.openSmartConsent}
          style={[
            styles.secondaryActionBtn,
            {
              backgroundColor: theme.darkMode
                ? 'rgba(16, 185, 129, 0.12)'
                : '#ECFDF5',
              borderColor: theme.darkMode
                ? 'rgba(16, 185, 129, 0.3)'
                : '#A7F3D0',
            },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="#059669"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M9 12l2 2 4-4"
              stroke="#059669"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.secondaryActionText}>Smart Consent</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View
        style={[
          styles.ndprBanner,
          {
            backgroundColor: theme.darkMode
              ? 'rgba(14, 165, 233, 0.08)'
              : '#F0F9FF',
            borderColor: theme.darkMode
              ? 'rgba(14, 165, 233, 0.25)'
              : '#BAE6FD',
          },
        ]}
      >
        <Text style={{ fontSize: 16 }}>🔒</Text>
        <Text style={[styles.ndprText, { color: theme.darkMode ? '#7dd3fc' : '#0369A1' }]}>
          Every share generates an auto-expiring encryption key. Doctors cannot retain permanent copies without your explicit renewal.
        </Text>
      </View>

      {/* Active Shares Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Shared Grants</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{activeSharesView.length}</Text>
        </View>
      </View>

      {/* Empty State */}
      {activeSharesView.length === 0 && (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
            ]}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Circle cx="18" cy="5" r="3" stroke={theme.mutedLight} strokeWidth={1.8} />
              <Circle cx="6" cy="12" r="3" stroke={theme.mutedLight} strokeWidth={1.8} />
              <Circle cx="18" cy="19" r="3" stroke={theme.mutedLight} strokeWidth={1.8} />
              <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={theme.mutedLight} strokeWidth={1.8} />
            </Svg>
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No active shares</Text>
          <Text style={[styles.emptySub, { color: theme.mutedLight }]}>
            When you share records with a clinic or doctor via WelliBridge or Smart Consent, they will appear here with live auto-expiry tracking.
          </Text>
        </View>
      )}

      {/* Active Shares List */}
      <View style={styles.sharesList}>
        {activeSharesView.map((sh) => {
          const pin = sh.id ? sh.id.replace(/\D/g, '').slice(-6) || '849201' : '849201';
          return (
            <View
              key={sh.id}
              style={[
                styles.shareCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              {/* Card Top Row */}
              <View style={styles.cardTopRow}>
                <View style={[styles.initialsBadge, { backgroundColor: '#041E42' }]}>
                  <Text style={styles.initialsText}>{sh.initials}</Text>
                </View>

                <View style={styles.cardHeaderInfo}>
                  <Text
                    style={[styles.doctorName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {sh.doctorName}
                  </Text>
                  <Text style={[styles.scopeText, { color: theme.muted }]}>
                    {sh.scopeLabel ?? `${sh.recordCount} records`}
                  </Text>
                </View>

                {/* Status Pill */}
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>

              {/* Expiry & PIN Meta Box */}
              <View
                style={[
                  styles.metaBox,
                  {
                    backgroundColor: theme.darkMode
                      ? 'rgba(255,255,255,0.04)'
                      : '#F8FAFC',
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: theme.mutedLight }]}>EXPIRES</Text>
                  <Text style={[styles.metaValue, { color: '#E11D48' }]}>
                    ⏳ {sh.expiresLabel}
                  </Text>
                </View>

                <View style={styles.metaDivider} />

                <View style={styles.metaItem}>
                  <Text style={[styles.metaLabel, { color: theme.mutedLight }]}>BRIDGE PIN</Text>
                  <Text style={[styles.metaValue, { color: '#0EA5E9' }]}>
                    🔑 {pin.slice(0, 3)}-{pin.slice(3)}
                  </Text>
                </View>

                {sh.writeAccess && (
                  <>
                    <View style={styles.metaDivider} />
                    <View style={styles.metaItem}>
                      <Text style={[styles.metaLabel, { color: theme.mutedLight }]}>ACCESS</Text>
                      <Text style={[styles.metaValue, { color: '#059669' }]}>
                        ✍️ Write Allowed
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {sh.purpose ? (
                <Text style={[styles.purposeText, { color: theme.muted }]}>
                  Purpose: "{sh.purpose}"
                </Text>
              ) : null}

              {/* Bottom Actions */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleCopyLink(sh)}
                  style={[
                    styles.cardActionBtn,
                    {
                      backgroundColor: theme.darkMode
                        ? 'rgba(14, 165, 233, 0.12)'
                        : '#F0F9FF',
                      borderColor: theme.darkMode
                        ? 'rgba(14, 165, 233, 0.3)'
                        : '#BAE6FD',
                    },
                  ]}
                >
                  <Text style={[styles.cardActionText, { color: '#0284C7' }]}>
                    Copy Bridge Link
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleRevoke(sh.id, sh.doctorName)}
                  style={[
                    styles.cardActionBtn,
                    {
                      backgroundColor: theme.darkMode
                        ? 'rgba(244, 63, 94, 0.12)'
                        : '#FFF1F2',
                      borderColor: theme.darkMode
                        ? 'rgba(244, 63, 94, 0.3)'
                        : '#FECDD3',
                    },
                  ]}
                >
                  <Text style={[styles.cardActionText, { color: '#E11D48' }]}>
                    Revoke
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  primaryActionBtn: {
    flex: 1.2,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    color: '#059669',
    fontSize: 13.5,
    fontWeight: '700',
  },
  ndprBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  ndprText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: '#041E42',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  sharesList: {
    gap: 12,
  },
  shareCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  initialsBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13.5,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  scopeText: {
    fontSize: 12,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  metaDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  purposeText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  cardActionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
