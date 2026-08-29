import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
            You control exactly what's shared, with who, for how long.
          </Text>
        </View>
      </View>

      {/* New Share Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => actions.openShareFlow()}
        style={styles.newShareBtn}
      >
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path
            d="M10 3v14M3 10h14"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.newShareText}>New Share</Text>
      </TouchableOpacity>

      {/* Smart Consent Controls Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={actions.openSmartConsent}
        style={styles.smartConsentBtn}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M13.5 6.5L17.5 10.5L13.5 14.5"
            stroke="#059669"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17 10.5H4.5"
            stroke="#059669"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Circle cx="19" cy="17" r="2.5" stroke="#059669" strokeWidth={1.8} />
        </Svg>
        <Text style={styles.smartConsentText}>Smart Consent Controls</Text>
      </TouchableOpacity>

      {/* Active Shares Header */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Shares</Text>

      {/* Empty State */}
      {activeSharesView.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.mutedLight }]}>
            No active shares right now.
          </Text>
        </View>
      )}

      {/* Active Shares List */}
      <View style={styles.sharesList}>
        {activeSharesView.map((sh) => (
          <View
            key={sh.id}
            style={[
              styles.shareCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.initialsBadge}>
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
                  {sh.scopeLabel ?? `${sh.recordCount} records`} · expires {sh.expiresLabel}
                </Text>
              </View>

              <View style={styles.statusTags}>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>Active</Text>
                </View>
                {sh.writeAccess && (
                  <View style={styles.writeTag}>
                    <Text style={styles.writeTagText}>Write Access</Text>
                  </View>
                )}
                {sh.ownerLabel && (
                  <View style={styles.ownerTag}>
                    <Text style={styles.ownerTagText}>{sh.ownerLabel}</Text>
                  </View>
                )}
              </View>
            </View>

            {sh.purpose ? (
              <Text style={[styles.purposeText, { color: theme.mutedLight }]}>
                "{sh.purpose}"
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => actions.revokeShare(sh.id)}
              style={styles.revokeBtn}
            >
              <Text style={styles.revokeText}>Revoke Access</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
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
  },
  subtitle: {
    fontSize: 13,
  },
  newShareBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  newShareText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  smartConsentBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  smartConsentText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13.5,
  },
  sharesList: {
    gap: 12,
  },
  shareCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  initialsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 13,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  scopeText: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTags: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activeTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  activeTagText: {
    color: '#10b981',
    fontSize: 10.5,
    fontWeight: '700',
  },
  writeTag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: '#fdf4ec',
  },
  writeTagText: {
    color: '#92582b',
    fontSize: 9.5,
    fontWeight: '700',
  },
  ownerTag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: '#fdf4ec',
  },
  ownerTagText: {
    color: '#92582b',
    fontSize: 9.5,
    fontWeight: '700',
  },
  purposeText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  revokeBtn: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revokeText: {
    color: '#dc2626',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
