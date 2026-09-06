import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { LogoMark } from '../components/Logo';
import { RECORD_META } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const PALETTE = {
  ink: '#0B2545',
  inkSoft: '#173863',
  sky: '#3E7CBF',
  skySoft: '#EAF1F9',
  paper: '#F5F2EA',
  paperLine: '#E4DFD1',
  seal: '#2F6D4F',
  sealSoft: '#E7F0EA',
  amber: '#B8863A',
  amberSoft: '#FBF3E6',
  text: '#1B1F27',
  muted: '#6B7280',
  white: '#FFFFFF',
  badge: '#C4453D',
  emergencyGold: '#E8B84B',
  emergencySub: '#B9C7DA',
};

export function HomeScreen({ app }: { app: WelliApp }) {
  const { state, actions, records, family } = app;

  const activeMember =
    family.find((f) => f.id === state.activeFamilyId) ??
    family[0] ?? { id: 'me', name: 'Chibuike Joshua Nwogha', initials: 'CJ' };
  const isGuardianView = state.activeFamilyId !== 'me';
  const ownedRecords = records.filter(
    (r) => r.ownerId === state.activeFamilyId || r.ownerId === 'me'
  );
  const recentRecords = ownedRecords.slice(0, 3);
  const hasUpcomingVisit = Boolean(state.bookingFacilityId && state.bookingDate);
  const vitals = state.vitalsLogs || [];
  const memberName =
    activeMember.name && activeMember.name !== 'You'
      ? activeMember.name
      : activeMember.email || activeMember.phone || 'Chibuike Joshua Nwogha';
  const unreadCount = state.notifications.filter((n) => !n.read).length;

  const initials =
    activeMember.initials ||
    (activeMember.name
      ? activeMember.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'CJ');

  return (
    <View style={styles.screen}>
      {/* ---------- Top bar ---------- */}
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <LogoMark size={24} shieldColor="#021F50" markColor="#ffffff" />
            <Text style={styles.brandText}>
              Welli<Text style={styles.brandSky}>Record</Text>
            </Text>
          </View>
          <View style={styles.rightCluster}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.toggleNotifications}
              style={styles.iconBtn}
              accessibilityLabel="Notifications"
            >
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
                  stroke={PALETTE.inkSoft}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M13.7 21a2 2 0 0 1-3.4 0"
                  stroke={PALETTE.inkSoft}
                  strokeWidth={1.8}
                />
              </Svg>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => actions.setTab('profile')}
              style={styles.avatar}
              accessibilityLabel="Profile"
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile switcher */}
        <View style={styles.viewingBlock}>
          <View style={styles.viewingLabelRow}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={8} r={3.2} stroke={PALETTE.muted} strokeWidth={2} />
              <Path
                d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6"
                stroke={PALETTE.muted}
                strokeWidth={2}
              />
            </Svg>
            <Text style={styles.viewingLabel}>VIEWING RECORDS FOR</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewingRow}
          >
            {family.map((f) => {
              const isSelected = state.activeFamilyId === f.id;
              const label =
                f.id === 'me'
                  ? 'You'
                  : f.name
                  ? f.name.split(' ')[0]
                  : 'Dependent';
              return (
                <TouchableOpacity
                  key={f.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    actions.setFamily(f.id);
                  }}
                  style={[
                    styles.viewingChip,
                    isSelected
                      ? styles.viewingChipActive
                      : styles.viewingChipInactive,
                  ]}
                >
                  {isSelected && <View style={styles.dot} />}
                  <Text
                    style={[
                      styles.viewingChipText,
                      isSelected
                        ? styles.viewingChipTextActive
                        : styles.viewingChipTextInactive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {family.length === 1 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => actions.openAddFamilyMember()}
                style={[styles.viewingChip, styles.viewingChipInactive]}
              >
                <Text style={styles.viewingChipTextInactive}>+ Dependent</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ---------- Scroll body ---------- */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>Good day</Text>
        <Text style={styles.name}>{memberName}</Text>

        {/* Guardian Notice (if active) */}
        {isGuardianView && (
          <View style={styles.guardianBanner}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                stroke={PALETTE.amber}
                strokeWidth={1.8}
              />
            </Svg>
            <Text style={styles.guardianText}>
              Managing {activeMember.name}'s vault as guardian
            </Text>
          </View>
        )}

        {/* Emergency ID Card */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={actions.openEmergency}
          style={styles.emergencyCardOuter}
          accessibilityLabel="Emergency ID"
        >
          <LinearGradient
            colors={[PALETTE.ink, PALETTE.inkSoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emergencyCard}
          >
            <View style={styles.emergencyIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2L4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
                  stroke={PALETTE.emergencyGold}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 8v5"
                  stroke={PALETTE.emergencyGold}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
                <Circle cx={12} cy={16} r={0.6} fill={PALETTE.emergencyGold} />
              </Svg>
            </View>
            <View style={styles.emergencyText}>
              <Text style={styles.emergencyTitle}>Emergency ID</Text>
              <Text style={styles.emergencySub}>
                Tap for allergies, blood type and contacts
              </Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 6l6 6-6 6"
                stroke={PALETTE.emergencySub}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => actions.openShareFlow()}
            style={styles.actionCard}
            accessibilityLabel="Share records"
          >
            <View style={[styles.actionIcon, { backgroundColor: PALETTE.skySoft }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx={6} cy={12} r={2.3} stroke={PALETTE.sky} strokeWidth={1.8} />
                <Circle cx={18} cy={6} r={2.3} stroke={PALETTE.sky} strokeWidth={1.8} />
                <Circle cx={18} cy={18} r={2.3} stroke={PALETTE.sky} strokeWidth={1.8} />
                <Path
                  d="M8 11l8-4M8 13l8 4"
                  stroke={PALETTE.sky}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>Share records</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.openUpload}
            style={styles.actionCard}
            accessibilityLabel="Scan document"
          >
            <View style={[styles.actionIcon, { backgroundColor: PALETTE.sealSoft }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M7 3h8l4 4v14H7z"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M15 3v4h4"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M9 12h6M9 15h6M9 9h2"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>Scan document</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => actions.setTab('care')}
            style={styles.actionCard}
            accessibilityLabel="Book visit"
          >
            <View style={[styles.actionIcon, { backgroundColor: PALETTE.amberSoft }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 21s-7-4.6-9.5-9C.6 8.4 2.4 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.6 0 5.4 3.4 3.5 7-2.5 4.4-9.5 9-9.5 9z"
                  stroke={PALETTE.amber}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.actionLabel}>Book visit</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Visit Card (if booked) */}
        {hasUpcomingVisit && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => actions.setTab('care')}
            style={styles.upcomingCard}
          >
            <View style={styles.pulseDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upcomingTitle}>Upcoming Healthcare Consultation</Text>
              <Text style={styles.upcomingTime}>
                {state.bookingDate} · {state.bookingTimeSlot || 'Confirmed'}
              </Text>
            </View>
            <Text style={styles.joinText}>View ›</Text>
          </TouchableOpacity>
        )}

        {/* ---------- Vitals & biometrics ---------- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Vitals & biometrics</Text>
          {vitals.length > 0 && <Text style={styles.sectionMeta}>Synced</Text>}
        </View>

        {vitals.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: PALETTE.skySoft }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M2 12h4l2 6 4-12 2 6h8"
                  stroke={PALETTE.sky}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No vitals recorded yet</Text>
            <Text style={styles.emptySub}>
              Blood pressure, glucose, and heart rate will appear here once recorded.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                hapticFeedback.medium();
                actions.openUpload();
              }}
              style={[styles.emptyBtn, { backgroundColor: PALETTE.ink }]}
              accessibilityLabel="Add your first record"
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 5v14M5 12h14"
                  stroke="#FFFFFF"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.emptyBtnText}>Add your first record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.vitalsScroll}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {vitals.map((v) => (
              <View key={v.id || v.timestamp} style={styles.vitalCard}>
                <Text style={styles.vitalLabel}>
                  {v.type === 'bp'
                    ? 'Blood Pressure'
                    : v.type === 'glucose'
                    ? 'Fasting Glucose'
                    : 'Heart Rate'}
                </Text>
                <Text style={styles.vitalValue}>
                  {v.primaryValue}
                  <Text style={styles.vitalUnit}> {v.unit}</Text>
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ---------- Recent records ---------- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent records</Text>
          {recentRecords.length > 0 && (
            <TouchableOpacity onPress={() => actions.setTab('records')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: PALETTE.sealSoft }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M7 3h8l4 4v14H7z"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M15 3v4h4"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                />
                <Path
                  d="M9 12h6M9 15h6M9 9h2"
                  stroke={PALETTE.seal}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No records in your vault yet</Text>
            <Text style={styles.emptySub}>
              Upload a lab result, prescription, or clinical note to secure it in your
              vault.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                hapticFeedback.medium();
                actions.openUpload();
              }}
              style={[styles.emptyBtn, { backgroundColor: PALETTE.seal }]}
              accessibilityLabel="Add your first record"
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 5v14M5 12h14"
                  stroke="#FFFFFF"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={styles.emptyBtnText}>Add your first record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {recentRecords.map((r) => {
              const meta = RECORD_META[r.type] || {
                tint: PALETTE.skySoft,
                emoji: '📋',
              };
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.75}
                  onPress={() => actions.openRecord(r.id)}
                  style={styles.recordItem}
                >
                  <View
                    style={[styles.recordEmojiBox, { backgroundColor: meta.tint }]}
                  >
                    <Text style={styles.recordEmoji}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.recordSub}>
                      {r.provider} · {r.date}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.paper,
  },
  topbar: {
    backgroundColor: PALETTE.paper,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '600',
    fontSize: 18,
    color: PALETTE.ink,
    letterSpacing: -0.2,
  },
  brandSky: {
    color: PALETTE.sky,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.paperLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: PALETTE.badge,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: PALETTE.paper,
  },
  badgeText: {
    color: PALETTE.white,
    fontSize: 9,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  viewingBlock: {
    marginBottom: 14,
  },
  viewingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  viewingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.muted,
    letterSpacing: 0.4,
  },
  viewingRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
  },
  viewingChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewingChipActive: {
    backgroundColor: PALETTE.skySoft,
    borderColor: PALETTE.sky,
  },
  viewingChipInactive: {
    backgroundColor: PALETTE.white,
    borderColor: PALETTE.paperLine,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.sky,
  },
  viewingChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewingChipTextActive: {
    color: PALETTE.ink,
  },
  viewingChipTextInactive: {
    color: PALETTE.muted,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 36,
  },
  greeting: {
    fontSize: 13,
    color: PALETTE.muted,
    marginBottom: 2,
  },
  name: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '600',
    fontSize: 22,
    color: PALETTE.ink,
    marginBottom: 18,
  },
  guardianBanner: {
    borderRadius: 12,
    backgroundColor: PALETTE.amberSoft,
    borderWidth: 1,
    borderColor: '#F3DCC4',
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guardianText: {
    fontSize: 12,
    color: '#8A5A1C',
    fontWeight: '600',
    flex: 1,
  },
  emergencyCardOuter: {
    borderRadius: 16,
    marginBottom: 18,
    shadowColor: PALETTE.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  emergencyCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emergencyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.white,
    marginBottom: 2,
  },
  emergencySub: {
    fontSize: 12,
    color: PALETTE.emergencySub,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 26,
  },
  actionCard: {
    flex: 1,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.paperLine,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.text,
    textAlign: 'center',
  },
  upcomingCard: {
    borderRadius: 14,
    backgroundColor: PALETTE.skySoft,
    borderWidth: 1,
    borderColor: '#CDE0F3',
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PALETTE.sky,
  },
  upcomingTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PALETTE.ink,
  },
  upcomingTime: {
    fontSize: 12,
    color: PALETTE.muted,
    marginTop: 1,
  },
  joinText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: PALETTE.sky,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.ink,
  },
  sectionMeta: {
    fontSize: 12,
    color: PALETTE.muted,
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: PALETTE.sky,
  },
  emptyCard: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.paperLine,
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: PALETTE.muted,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: 16,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  emptyBtnText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '600',
  },
  vitalsScroll: {
    marginBottom: 22,
  },
  vitalCard: {
    minWidth: 115,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.paperLine,
    borderRadius: 14,
    padding: 13,
    marginRight: 10,
  },
  vitalLabel: {
    fontSize: 11,
    color: PALETTE.muted,
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: PALETTE.ink,
  },
  vitalUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: PALETTE.muted,
  },
  recordsList: {
    gap: 8,
    marginBottom: 20,
  },
  recordItem: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.paperLine,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordEmoji: {
    fontSize: 18,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: PALETTE.text,
  },
  recordSub: {
    fontSize: 11.5,
    color: PALETTE.muted,
    marginTop: 2,
  },
});
