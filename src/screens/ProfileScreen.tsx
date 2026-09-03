import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

interface SettingsItem {
  id: string;
  emoji: string;
  emojiBg: string;
  title: string;
  subtitle: string;
  action?: () => void;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  badge?: string;
}

export function ProfileScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, family } = app;
  const owner = family.find((f) => f.role === 'owner') ?? family[0];

  // Collapsible settings groups: Account open by default, others collapsed
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    account: true,
    security: false,
    app: false,
  });

  const toggleGroup = (key: 'account' | 'security' | 'app') => {
    hapticFeedback.selection();
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const accountItems: SettingsItem[] = [
    {
      id: 'personal_info',
      emoji: '👤',
      emojiBg: '#eff6ff',
      title: 'Personal Information',
      subtitle: 'Demographics, blood type & vitals',
      action: actions.openPersonalInfo,
    },
    {
      id: 'family_access',
      emoji: '👪',
      emojiBg: '#f0fdf4',
      title: 'Family & Caregivers',
      subtitle: 'Manage dependent access & child records',
      action: actions.openFamilyAccess,
    },
    {
      id: 'linked_accounts',
      emoji: '🔗',
      emojiBg: '#f5f3ff',
      title: 'Linked Healthcare Accounts',
      subtitle: 'Hospitals, HMO portals & lab networks',
      action: actions.openLinkedAccounts,
    },
    {
      id: 'billing_payments',
      emoji: '💳',
      emojiBg: '#fffbeb',
      title: 'Billing & HMO Copays',
      subtitle: 'Claims, invoices & payment history',
      action: actions.openBilling,
    },
    {
      id: 'recent_activity',
      emoji: '📋',
      emojiBg: '#f1f5f9',
      title: 'Audit Trail & Activity',
      subtitle: 'Recent vault access & sharing events',
      action: actions.openActivity,
    },
  ];

  const securityItems: SettingsItem[] = [
    {
      id: 'face_id',
      emoji: '🔒',
      emojiBg: '#fef2f2',
      title: 'Face ID / Biometrics',
      subtitle: 'Require biometric scan on launch',
      isSwitch: true,
      switchValue: state.faceIdEnabled,
      onSwitchChange: actions.toggleFaceId,
    },
    {
      id: 'privacy_security',
      emoji: '🛡️',
      emojiBg: '#ecfdf5',
      title: 'Privacy & Smart Consent',
      subtitle: 'Hospital permissions & time-locks',
      action: actions.openPrivacySecurity,
    },
    {
      id: 'vault_export',
      emoji: '📦',
      emojiBg: '#f0fdfa',
      title: 'Export Encrypted Backup',
      subtitle: 'Download password-protected vault archive',
      action: actions.openVaultExport,
    },
    {
      id: 'proxy_log',
      emoji: '📜',
      emojiBg: '#f8fafc',
      title: 'Proxy Access Log',
      subtitle: 'Audit trail of authorized caregiver actions',
      action: actions.openProxyLog,
    },
  ];

  const appItems: SettingsItem[] = [
    {
      id: 'dark_mode',
      emoji: '🌙',
      emojiBg: '#f1f5f9',
      title: 'Dark Appearance',
      subtitle: 'Toggle dark interface styling',
      isSwitch: true,
      switchValue: state.darkMode,
      onSwitchChange: actions.toggleDarkMode,
    },
    {
      id: 'notifications',
      emoji: '🔔',
      emojiBg: '#fff7ed',
      title: 'Notifications & Alerts',
      subtitle: 'Appointment reminders & refill alerts',
      action: actions.openNotificationSettings,
    },
    {
      id: 'vitals_sync',
      emoji: '⌚',
      emojiBg: '#fdf2f8',
      title: 'Apple Health & Wearables',
      subtitle: 'Apple Health connected · Fitbit available',
      action: actions.openNotificationSettings,
      badge: 'Connected',
    },
    {
      id: 'language',
      emoji: '🌐',
      emojiBg: '#eff6ff',
      title: `Language (${state.language})`,
      subtitle: 'System language & localized medical terms',
      action: actions.openLanguage,
    },
    {
      id: 'welcome_tour',
      emoji: '✨',
      emojiBg: '#faf5ff',
      title: 'Replay Welcome Tour',
      subtitle: 'Interactive overview of WelliRecord',
      action: actions.openOnboarding,
    },
    {
      id: 'about',
      emoji: '🏥',
      emojiBg: '#f0fdf4',
      title: 'About WelliRecord',
      subtitle: 'Version 1.0.0 · HEFAMAA & NDPR compliant',
      action: () => actions.openWelcomeHome('about'),
    },
  ];

  const renderGroup = (
    key: 'account' | 'security' | 'app',
    title: string,
    subtitle: string,
    icon: string,
    items: SettingsItem[]
  ) => {
    const isExpanded = Boolean(expandedGroups[key]);

    return (
      <View
        style={[
          styles.groupCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Group Header Toggle */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleGroup(key)}
          style={styles.groupHeader}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${isExpanded ? 'Expanded' : 'Collapsed'}. Tap to toggle.`}
        >
          <View style={styles.groupHeaderLeft}>
            <Text style={{ fontSize: 18 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupTitle, { color: theme.text }]}>
                {title}
              </Text>
              <Text style={[styles.groupSub, { color: theme.muted }]}>
                {subtitle}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.expandBadge,
              { backgroundColor: isExpanded ? '#041E42' : theme.surface2 },
            ]}
          >
            <Svg width={12} height={12} viewBox="0 0 20 20">
              <Path
                d={isExpanded ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'}
                stroke={isExpanded ? '#ffffff' : theme.muted}
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Group Items */}
        {isExpanded && (
          <View style={[styles.groupItemList, { borderTopColor: theme.border }]}>
            {items.map((item, idx) => {
              const isLast = idx === items.length - 1;

              if (item.isSwitch) {
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      { borderBottomColor: theme.border, borderBottomWidth: isLast ? 0 : 1 },
                    ]}
                  >
                    <View style={[styles.itemEmojiBox, { backgroundColor: item.emojiBg }]}>
                      <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.itemSub, { color: theme.muted }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Switch
                      value={item.switchValue}
                      onValueChange={item.onSwitchChange}
                      trackColor={{ false: '#cbd5e1', true: '#0EA5E9' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={item.action}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: theme.border, borderBottomWidth: isLast ? 0 : 1 },
                  ]}
                >
                  <View style={[styles.itemEmojiBox, { backgroundColor: item.emojiBg }]}>
                    <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemSub, { color: theme.muted }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                  {item.badge ? (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.badge}</Text>
                    </View>
                  ) : (
                    <Svg width={14} height={14} viewBox="0 0 20 20">
                      <Path
                        d="M7 4l6 6-6 6"
                        stroke={theme.mutedLight}
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={true}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile Header: Tapping opens full personal profile */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          hapticFeedback.selection();
          actions.openPersonalInfo();
        }}
        style={[
          styles.profileHeaderCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Profile for ${owner.name}. Tap to view full personal profile.`}
      >
        {state.tabHistory.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.goBackTab}
            style={[
              styles.backBtn,
              { backgroundColor: theme.surface2, borderColor: theme.border },
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

        <Avatar member={owner} size={54} fontSize={19} />

        <View style={styles.profileText}>
          <View style={styles.ownerNameRow}>
            <Text
              style={[styles.ownerName, { color: theme.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {owner.name}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 20 20" style={{ marginLeft: 4, flexShrink: 0 }}>
              <Path
                d="M7 4l6 6-6 6"
                stroke={theme.mutedLight}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.memberMetaRow}>
            {owner.wrId ? (
              <Text style={styles.memberIdText}>
                ID: {owner.wrId}
              </Text>
            ) : null}
            <Text style={styles.profileViewHint}>
              Tap to view full profile ›
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Emergency ID Card: Life-Critical Treatment (Exclusive Dark/Crimson Pattern) */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          hapticFeedback.medium();
          actions.openEmergency();
        }}
        style={styles.emergencyCardOuter}
        accessibilityRole="button"
        accessibilityLabel="Emergency Medical ID Card. Tap to view life-critical details."
      >
        <LinearGradient
          colors={['#090d16', '#172554']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emergencyCard}
        >
          {/* Top Tag Row */}
          <View style={styles.emergencyTopRow}>
            <View style={styles.emergencyBadge}>
              <View style={styles.emergencyDotPulse} />
              <Text style={styles.emergencyBadgeText}>LIFE-CRITICAL · FIRST RESPONDER</Text>
            </View>
            <Text style={styles.emergencyLockedText}>🔒 Lock-Screen Ready</Text>
          </View>

          {/* Main Card Content */}
          <View style={styles.emergencyMainRow}>
            <View style={styles.emergencyIconBox}>
              <Text style={{ fontSize: 24 }}>🚨</Text>
            </View>
            <View style={styles.emergencyTextContent}>
              <Text style={styles.emergencyTitle}>Emergency Medical ID</Text>
              <Text style={styles.emergencySub}>
                Blood Type {owner.bloodType || 'O+'} · Allergies ({owner.allergies?.length || 0}) · ICE Contacts
              </Text>
            </View>
          </View>

          {/* Bottom Action Footer */}
          <View style={styles.emergencyBottomRow}>
            <Text style={styles.emergencyHint}>
              Accessible to paramedics and ERs during critical trauma
            </Text>
            <View style={styles.emergencyActionBtn}>
              <Text style={styles.emergencyActionBtnText}>View Card ›</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Settings Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Settings & Preferences
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.mutedLight }]}>
          3 Groups
        </Text>
      </View>

      {/* Group 1: Account */}
      {renderGroup(
        'account',
        'Account & Family',
        'Personal details, caregivers, billing · 5 items',
        '👤',
        accountItems
      )}

      {/* Group 2: Security */}
      {renderGroup(
        'security',
        'Security & Vault',
        'Face ID lock, smart consent, backups · 4 items',
        '🔐',
        securityItems
      )}

      {/* Group 3: App */}
      {renderGroup(
        'app',
        'App & Preferences',
        'Appearance, notifications, health sync · 6 items',
        '⚙️',
        appItems
      )}

      {/* Log Out Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          hapticFeedback.light();
          actions.logOut();
        }}
        style={[
          styles.logoutBtn,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  memberIdText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '700',
  },
  profileViewHint: {
    fontSize: 12,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  emergencyCardOuter: {
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  emergencyCard: {
    padding: 14,
  },
  emergencyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  emergencyBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  emergencyDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  emergencyBadgeText: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emergencyLockedText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  emergencyMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  emergencyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTextContent: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  emergencySub: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  emergencyBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  emergencyHint: {
    color: '#94a3b8',
    fontSize: 11,
    flex: 1,
  },
  emergencyActionBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  emergencyActionBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
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
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupSub: {
    fontSize: 11.5,
  },
  expandBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupItemList: {
    borderTopWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  itemEmojiBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  itemBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
