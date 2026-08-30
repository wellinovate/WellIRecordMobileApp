import React from 'react';
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
import type { WelliApp } from '../state/useWelliApp';

interface SettingsRow {
  emoji: string;
  label: string;
  action: () => void;
}

export function ProfileScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, family } = app;
  const owner = family.find((f) => f.role === 'owner') ?? family[0];

  const settingsRows: SettingsRow[] = [
    { emoji: '👤', label: 'Personal Info', action: actions.openPersonalInfo },
    { emoji: '🔔', label: 'Notifications', action: actions.openNotificationSettings },
    { emoji: '🔐', label: 'Privacy & Security', action: actions.openPrivacySecurity },
    { emoji: '📦', label: 'Export Encrypted Vault Backup', action: actions.openVaultExport },
    { emoji: '🔗', label: 'Linked Accounts', action: actions.openLinkedAccounts },
    { emoji: '💳', label: 'Billing & Payments', action: actions.openBilling },
    { emoji: '📋', label: 'Recent Activity', action: actions.openActivity },
    { emoji: '🌐', label: `Language (${state.language})`, action: actions.openLanguage },
    { emoji: '✨', label: 'Replay Welcome Tour', action: actions.openOnboarding },
    { emoji: '🏥', label: 'About WelliRecord & Portal', action: () => actions.openWelcomeHome('about') },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      alwaysBounceVertical={true}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
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
        <Avatar member={owner} size={58} fontSize={20} />
        <View style={styles.profileText}>
          <Text style={[styles.ownerName, { color: theme.text }]}>
            {owner.name}
          </Text>
          {owner.wrId ? (
            <Text style={[styles.memberSince, { color: '#0284c7', fontWeight: '600' }]}>
              Member ID: {owner.wrId}
            </Text>
          ) : (
            <Text style={[styles.memberSince, { color: theme.muted }]}>
              Verified Health Vault
            </Text>
          )}
        </View>
      </View>

      {/* Emergency ID Card Trigger */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={actions.openEmergency}
        style={styles.emergencyCardOuter}
      >
        <LinearGradient
          colors={['#020617', '#1e3a8a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emergencyCard}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
              stroke="#fbbf24"
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.emergencyTitle}>Emergency ID Card</Text>
          <Svg width={16} height={16} viewBox="0 0 20 20">
            <Path
              d="M7 4l6 6-6 6"
              stroke="#93a5c9"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </LinearGradient>
      </TouchableOpacity>

      {/* Family Access Section */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Family & Caregiver Access
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={actions.openFamilyAccess}
        style={[
          styles.actionRow,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={styles.rowEmoji}>👪</Text>
        <Text style={[styles.rowLabel, { color: theme.text }]}>
          Manage Family Access
        </Text>
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
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={actions.openProxyLog}
        style={[
          styles.actionRow,
          { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 22 },
        ]}
      >
        <Text style={styles.rowEmoji}>📋</Text>
        <Text style={[styles.rowLabel, { color: theme.text }]}>
          Proxy Access Log
        </Text>
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
      </TouchableOpacity>

      {/* Vitals Sync */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Vitals & Wearable Sync
      </Text>

      <View
        style={[
          styles.cardGroup,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.syncRow}>
          <View style={[styles.syncIconBox, { backgroundColor: '#f0fdfa' }]}>
            <Text style={{ fontSize: 16 }}>🍎</Text>
          </View>
          <View style={styles.syncInfo}>
            <Text style={[styles.syncTitle, { color: theme.text }]}>Apple Health</Text>
            <Text style={styles.syncStatus}>Connected</Text>
          </View>
          <Switch
            value={true}
            trackColor={{ false: '#cbd5e1', true: '#10b981' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
            disabled
          />
        </View>

        <View style={[styles.innerDivider, { backgroundColor: theme.border }]} />

        <View style={styles.syncRow}>
          <View style={[styles.syncIconBox, { backgroundColor: '#fdf4ec' }]}>
            <Text style={{ fontSize: 16 }}>⌚</Text>
          </View>
          <View style={styles.syncInfo}>
            <Text style={[styles.syncTitle, { color: theme.text }]}>Fitbit</Text>
            <Text style={[styles.syncSub, { color: theme.mutedLight }]}>
              Not connected
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.connectLink}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings List */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>

      <View
        style={[
          styles.settingsBlock,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Dark Mode Toggle */}
        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Text style={styles.settingEmoji}>🌙</Text>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
          <Switch
            value={state.darkMode}
            onValueChange={actions.toggleDarkMode}
            trackColor={{ false: '#cbd5e1', true: '#0EA5E9' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
          />
        </View>

        {/* Face ID Toggle */}
        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Text style={styles.settingEmoji}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Face ID Lock{' '}
              <Text style={{ color: theme.mutedLight, fontWeight: '500' }}>
                (optional)
              </Text>
            </Text>
          </View>
          <Switch
            value={state.faceIdEnabled}
            onValueChange={actions.toggleFaceId}
            trackColor={{ false: '#cbd5e1', true: '#0EA5E9' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
          />
        </View>

        {/* Settings Navigation Rows */}
        {settingsRows.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            activeOpacity={0.7}
            onPress={row.action}
            style={[
              styles.settingItem,
              {
                borderBottomColor: theme.border,
                borderBottomWidth: i === settingsRows.length - 1 ? 0 : 1,
              },
            ]}
          >
            <Text style={styles.settingEmoji}>{row.emoji}</Text>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              {row.label}
            </Text>
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
          </TouchableOpacity>
        ))}
      </View>

      {/* Log Out */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={actions.logOut}
        style={styles.logoutBtn}
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  ownerName: {
    fontSize: 18,
    fontWeight: '800',
  },
  memberSince: {
    fontSize: 12.5,
    marginTop: 2,
  },
  emergencyCardOuter: {
    marginBottom: 22,
    borderRadius: 16,
    shadowColor: '#041e42',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  emergencyCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emergencyTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rowEmoji: {
    fontSize: 17,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  cardGroup: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 22,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  syncIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  syncStatus: {
    fontSize: 11.5,
    color: '#10b981',
    fontWeight: '600',
  },
  syncSub: {
    fontSize: 11.5,
  },
  connectLink: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  innerDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  settingsBlock: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  settingEmoji: {
    fontSize: 17,
    width: 22,
    textAlign: 'center',
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
