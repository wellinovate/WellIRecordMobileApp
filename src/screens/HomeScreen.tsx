import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { RECORD_META } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function HomeScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, records, family } = app;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0] ?? { id: 'me', name: 'You', initials: 'U' };
  const isGuardianView = state.activeFamilyId !== 'me';
  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId || r.ownerId === 'me');
  const recentRecords = ownedRecords.slice(0, 3);
  const hasUpcomingVisit = Boolean(state.bookingFacilityId && state.bookingDate);
  const vitals = state.vitalsLogs || [];
  const memberName =
    activeMember.name && activeMember.name !== 'You'
      ? activeMember.name
      : activeMember.email || activeMember.phone || 'You';
  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.headerRow}>
        <Logo height={26} color={theme.text} />
        <View style={styles.headerRight}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.toggleNotifications}
            style={[
              styles.notifButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 10a6 6 0 1112 0c0 3 1 4.5 2 5.5H4c1-1 2-2.5 2-5.5z"
                stroke={theme.text}
                strokeWidth={1.7}
                strokeLinejoin="round"
              />
              <Path d="M9.5 18.5a2.5 2.5 0 005 0" stroke={theme.text} strokeWidth={1.7} />
            </Svg>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Avatar member={activeMember} size={38} fontSize={14} />
        </View>
      </View>

      {/* Active Profile - Dynamic Family Tab Row (You + Dependents) */}
      {family.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.familyScroll}
        >
          {family.map((f) => {
            const isSelected = state.activeFamilyId === f.id;
            const label = f.id === 'me' ? 'You' : (f.name ? f.name.split(' ')[0] : 'Dependent');
            return (
              <Chip
                key={f.id}
                label={label}
                active={isSelected}
                onClick={() => {
                  hapticFeedback.selection();
                  actions.setFamily(f.id);
                }}
              />
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.familyScroll}>
          <Chip
            label="You"
            active={true}
            onClick={() => {}}
          />
        </View>
      )}

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={[styles.greetingSub, { color: theme.muted }]}>Good day</Text>
        <Text style={[styles.greetingName, { color: theme.text }]}>
          {memberName}
        </Text>
      </View>

      {/* Guardian Notice (if active) */}
      {isGuardianView && (
        <View style={styles.guardianBanner}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
              stroke="#c87941"
              strokeWidth={1.8}
            />
          </Svg>
          <Text style={styles.guardianText}>
            Managing {activeMember.name}'s vault as guardian
          </Text>
        </View>
      )}

      {/* Emergency Medical ID Card */}
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
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
              stroke="#fbbf24"
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Path d="M12 8v5M12 16h.01" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>Emergency ID</Text>
            <Text style={styles.emergencySub}>Tap for allergies, blood type & contacts</Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 20 20">
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

      {/* Quick Action Buttons */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => actions.openShareFlow()}
          style={[
            styles.quickActionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={6} cy={12} r={2.6} stroke="#0EA5E9" strokeWidth={1.8} />
            <Circle cx={17} cy={6} r={2.6} stroke="#0EA5E9" strokeWidth={1.8} />
            <Circle cx={17} cy={18} r={2.6} stroke="#0EA5E9" strokeWidth={1.8} />
            <Path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" stroke="#0EA5E9" strokeWidth={1.6} />
          </Svg>
          <Text style={[styles.quickActionLabel, { color: theme.text }]}>Share Records</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={actions.openUpload}
          style={[
            styles.quickActionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={4} y={3} width={16} height={18} rx={2} stroke="#1a6b42" strokeWidth={1.8} />
            <Path d="M8 8h8M8 12h8M8 16h5" stroke="#1a6b42" strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
          <Text style={[styles.quickActionLabel, { color: theme.text }]}>Scan Document</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => actions.setTab('care')}
          style={[
            styles.quickActionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20s-7-4.4-7-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0121 10c0 5.6-7 10-7 10z"
              stroke="#c87941"
              strokeWidth={1.8}
            />
          </Svg>
          <Text style={[styles.quickActionLabel, { color: theme.text }]}>Book Visit</Text>
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
            <Text style={styles.upcomingTime}>{state.bookingDate} · {state.bookingTimeSlot || 'Confirmed'}</Text>
          </View>
          <Text style={styles.joinText}>View ›</Text>
        </TouchableOpacity>
      )}

      {/* Vitals Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Vitals & Biometrics</Text>
        {vitals.length > 0 ? (
          <Text style={[styles.sectionMeta, { color: theme.mutedLight }]}>Synced</Text>
        ) : null}
      </View>

      {vitals.length === 0 ? (
        <View
          style={[
            styles.emptySectionBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M22 12h-4l-3 9L9 3l-3 9H2"
              stroke={theme.mutedLight}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[styles.emptySectionTitle, { color: theme.text }]}>
            No vitals recorded yet
          </Text>
          <Text style={[styles.emptySectionSub, { color: theme.muted }]}>
            Blood pressure, glucose, and heart rate metrics will appear here once recorded.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vitalsScroll}
          contentContainerStyle={{ paddingRight: 10 }}
        >
          {vitals.map((v) => (
            <View
              key={v.id || v.timestamp}
              style={[
                styles.vitalCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.vitalLabel, { color: theme.muted }]}>
                {v.type === 'bp' ? 'Blood Pressure' : v.type === 'glucose' ? 'Fasting Glucose' : 'Heart Rate'}
              </Text>
              <Text style={[styles.vitalValue, { color: theme.text }]}>
                {v.primaryValue}
                <Text style={[styles.vitalUnit, { color: theme.mutedLight }]}> {v.unit}</Text>
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Recent Records Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Records</Text>
        {recentRecords.length > 0 && (
          <TouchableOpacity onPress={() => actions.setTab('records')}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {recentRecords.length === 0 ? (
        <View
          style={[
            styles.emptySectionBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Rect x={4} y={3} width={16} height={18} rx={2} stroke={theme.mutedLight} strokeWidth={1.8} />
            <Path d="M8 8h8M8 12h8M8 16h5" stroke={theme.mutedLight} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
          <Text style={[styles.emptySectionTitle, { color: theme.text }]}>
            No records in your vault yet
          </Text>
          <Text style={[styles.emptySectionSub, { color: theme.muted }]}>
            Upload a lab result, prescription, or clinical note to secure it in your vault.
          </Text>
        </View>
      ) : (
        <View style={styles.recordsList}>
          {recentRecords.map((r) => {
            const meta = RECORD_META[r.type] || { tint: '#e0f2fe', emoji: '📋' };
            return (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.7}
                onPress={() => actions.openRecord(r.id)}
                style={[
                  styles.recordItem,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={[styles.recordEmojiBox, { backgroundColor: meta.tint }]}>
                  <Text style={styles.recordEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.recordInfo}>
                  <Text
                    style={[styles.recordTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {r.title}
                  </Text>
                  <Text style={[styles.recordSub, { color: theme.muted }]}>
                    {r.provider} · {r.date}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  familyScroll: {
    marginBottom: 16,
  },
  greetingContainer: {
    marginBottom: 18,
  },
  greetingSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  guardianBanner: {
    borderRadius: 12,
    backgroundColor: '#fdf4ec',
    borderWidth: 1,
    borderColor: '#f3dcc4',
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guardianText: {
    fontSize: 12,
    color: '#92582b',
    fontWeight: '600',
    flex: 1,
  },
  emergencyCardOuter: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#041e42',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  emergencyCard: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  emergencySub: {
    color: '#93a5c9',
    fontSize: 12,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  upcomingCard: {
    borderRadius: 16,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
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
    backgroundColor: '#0EA5E9',
  },
  upcomingTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  upcomingTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  joinText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 12,
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  emptySectionBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  emptySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  emptySectionSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyVitals: {
    fontSize: 12.5,
    paddingVertical: 8,
    marginBottom: 14,
  },
  vitalsScroll: {
    marginBottom: 22,
  },
  vitalCard: {
    width: 110,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
  },
  vitalLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  vitalUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyRecords: {
    fontSize: 12.5,
    paddingVertical: 8,
  },
  recordsList: {
    gap: 8,
  },
  recordItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordEmoji: {
    fontSize: 16,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  recordSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  childImmCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    padding: 16,
    marginBottom: 16,
  },
  childImmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  childImmIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childImmTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4c1d95',
  },
  childImmSub: {
    fontSize: 12,
    color: '#6d28d9',
    marginTop: 1,
  },
  dueBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e9d5ff',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  nextDueText: {
    fontSize: 11.5,
    color: '#5b21b6',
    fontWeight: '600',
  },
  seniorCareCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 16,
    marginBottom: 16,
  },
  seniorCareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  seniorCareIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seniorCareTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
  },
  seniorCareSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 1,
  },
  logReadingBtn: {
    backgroundColor: '#059669',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  logReadingBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  vitalMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  seniorVitalMetric: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  svmLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  svmValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  svmUnit: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  svmTagGreen: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
    marginTop: 3,
  },
});
