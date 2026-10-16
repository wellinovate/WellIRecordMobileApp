import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LogoMark } from '../components/Logo';
import { OfflineSyncBanner } from '../components/OfflineSyncBanner';
import { EmergencyScanAlertBanner } from '../components/EmergencyScanAlertBanner';
import type { WelliApp } from '../state/useWelliApp';

const COLORS = {
  navy: '#082F67',
  navyDark: '#06285A',
  navyLight: '#244A7D',
  text: '#102D56',
  muted: '#64748B',
  border: '#E4E9F0',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  softBlue: '#EFF3FA',
  warningBg: '#FFF5E8',
  warningBorder: '#F0C994',
  warningText: '#9A5B1B',
  white: '#FFFFFF',
};

export function HomeScreen({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;

  const activeMember =
    family.find((member) => member.id === state.activeFamilyId) ??
    family[0] ?? {
      id: 'me',
      name: 'WelliRecord Patient',
      initials: 'WR',
    };

  const memberName =
    activeMember.name && activeMember.name !== 'You'
      ? activeMember.name
      : activeMember.email ||
        activeMember.phone ||
        'WelliRecord Patient';

  const firstName =
    memberName.trim().split(/\s+/)[0] || 'there';

  const unreadCount =
    state.notifications?.filter((notification) => !notification.read)
      .length ?? 0;

  const isGuardianView = state.activeFamilyId !== 'me';

  const recordId =
    activeMember.id === 'me'
      ? 'WR-DEMO-001'
      : `WR-${String(activeMember.id).toUpperCase()}`;

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Existing system banners remain functional */}
        <OfflineSyncBanner />
        <EmergencyScanAlertBanner app={app} />

        {/* =========================
            HERO
        ========================== */}
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <LogoMark
              size={31}
              shieldColor="#FFFFFF"
              markColor={COLORS.navy}
              strokeColor="#FFFFFF"
            />

            <Text style={styles.brandName}>
              WelliRecord
              <Text style={styles.tradeMark}>™</Text>
            </Text>
          </View>

          <Text style={styles.patientLabel}>
            {isGuardianView
              ? 'DEPENDENT RECORD'
              : 'ILLUSTRATIVE PATIENT'}
          </Text>

          <Text style={styles.greeting}>
            Hello, {firstName}
          </Text>

          <Text style={styles.heroCopy}>
            One patient. One trusted record. Accessible when it
            matters.
          </Text>
        </View>

        <View style={styles.body}>
          {/* =========================
              GUARDIAN STATE
          ========================== */}
          {isGuardianView && (
            <View style={styles.guardianBanner}>
              <ShieldIcon size={17} />

              <Text style={styles.guardianText}>
                Managing {memberName}'s health record as guardian
              </Text>
            </View>
          )}

          {/* =========================
              ALLERGY WARNING
          ========================== */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => actions.setTab('profile')}
            style={styles.allergyCard}
          >
            <WarningIcon />

            <View style={styles.allergyContent}>
              <Text style={styles.allergyTitle}>
                Allergies: not recorded
              </Text>

              <Text style={styles.allergySubtitle}>
                Review your allergy status before your next visit.
              </Text>
            </View>
          </TouchableOpacity>

          {/* =========================
              PATIENT RECORD CARD
          ========================== */}
          <View style={styles.recordCard}>
            <View style={styles.recordCardHeader}>
              <View style={styles.recordBrand}>
                <LogoMark
                  size={29}
                  shieldColor="#FFFFFF"
                  markColor={COLORS.navy}
                  strokeColor="#FFFFFF"
                />

                <Text style={styles.recordBrandText}>
                  WelliRecord
                  <Text style={styles.tradeMark}>™</Text>
                </Text>
              </View>

              <FingerprintIcon />
            </View>

            <Text style={styles.recordName}>
              {memberName}
            </Text>

            <Text style={styles.recordId}>
              Record ID · {recordId}
            </Text>

            <Text style={styles.recordDescription}>
              One patient ID links your record across facilities.
              This identity is illustrative.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => actions.openShareFlow()}
              style={styles.shareButton}
            >
              <Text style={styles.shareButtonText}>
                Share with WelliBridge
              </Text>
            </TouchableOpacity>
          </View>

          {/* =========================
              QUICK ACTIONS
          ========================== */}
          <Text style={styles.sectionTitle}>
            What would you like to do?
          </Text>

          <View style={styles.actionGrid}>
            <QuickAction
              title="My documents"
              subtitle="Keep uploads together"
              icon="documents"
              onPress={() => actions.setTab('records')}
            />

            <QuickAction
              title="Find care"
              subtitle="Hospitals & doctors"
              icon="care"
              onPress={() => actions.setTab('care')}
            />

            <QuickAction
              title="Emergency ID"
              subtitle="Always free to access"
              icon="emergency"
              onPress={actions.openEmergency}
            />

            <QuickAction
              title="Ask Assistant"
              subtitle="Help with app tasks"
              icon="assistant"
              onPress={() => actions.setTab('chat')}
            />
          </View>

          {/* =========================
              PROFILE / NOTIFICATIONS
          ========================== */}
          <View style={styles.settingsCard}>
            <SettingsRow
              icon="profile"
              title="Complete your profile"
              subtitle="Add an emergency contact and preferences"
              onPress={() => actions.setTab('profile')}
            />

            <View style={styles.rowDivider} />

            <SettingsRow
              icon="notification"
              title="Notifications"
              subtitle={
                unreadCount > 0
                  ? `${unreadCount} unread notification${
                      unreadCount === 1 ? '' : 's'
                    }`
                  : 'No in-app notifications to show'
              }
              onPress={actions.toggleNotifications}
            />
          </View>

          <Text style={styles.demoFooter}>
            Illustrative demo · no connected clinical data
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: QuickActionIcon;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.actionCard}
    >
      <View style={styles.actionIconWrap}>
        <ActionIcon type={icon} />
      </View>

      <Text style={styles.actionTitle}>
        {title}
      </Text>

      <Text style={styles.actionSubtitle}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

/* =========================================================
   SETTINGS ROW
========================================================= */

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: 'profile' | 'notification';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.settingsRow}
    >
      <View style={styles.settingsIcon}>
        {icon === 'profile' ? (
          <ProfileIcon />
        ) : (
          <NotificationIcon />
        )}
      </View>

      <View style={styles.settingsText}>
        <Text style={styles.settingsTitle}>
          {title}
        </Text>

        <Text style={styles.settingsSubtitle}>
          {subtitle}
        </Text>
      </View>

      <ChevronIcon />
    </TouchableOpacity>
  );
}

/* =========================================================
   ICONS
========================================================= */

type QuickActionIcon =
  | 'documents'
  | 'care'
  | 'emergency'
  | 'assistant';

function ActionIcon({
  type,
}: {
  type: QuickActionIcon;
}) {
  if (type === 'documents') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 3H15L19 7V20H7V3Z"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <Path
          d="M15 3V7H19"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <Path
          d="M4 7V21H15"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'care') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 21C12 21 18 15.4 18 10.5C18 6.9 15.3 4 12 4C8.7 4 6 6.9 6 10.5C6 15.4 12 21 12 21Z"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <Circle
          cx={12}
          cy={10.5}
          r={2.2}
          stroke={COLORS.navy}
          strokeWidth={1.6}
        />
      </Svg>
    );
  }

  if (type === 'emergency') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <Path
          d="M12 8V15M8.5 11.5H15.5"
          stroke={COLORS.navy}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L13.6 7.3L19 9L13.6 10.7L12 16L10.4 10.7L5 9L10.4 7.3L12 2Z"
        stroke={COLORS.navy}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      <Path
        d="M18 14L19 17L22 18L19 19L18 22L17 19L14 18L17 17L18 14Z"
        stroke={COLORS.navy}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4L21 20H3L12 4Z"
        stroke={COLORS.warningText}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      <Path
        d="M12 9V14"
        stroke={COLORS.warningText}
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      <Circle
        cx={12}
        cy={17}
        r={0.8}
        fill={COLORS.warningText}
      />
    </Svg>
  );
}

function ShieldIcon({
  size = 24,
}: {
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
        stroke={COLORS.navy}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FingerprintIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 8.5C8 6.2 9.7 5 12 5C15.3 5 17.5 7.4 17.5 10.7"
        stroke="#87A6CE"
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      <Path
        d="M5.5 10.5C5.5 6.7 8.2 4 12 4C16 4 18.7 6.9 18.7 10.8C18.7 14.5 17.4 17.5 15.7 20"
        stroke="#87A6CE"
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      <Path
        d="M8 11C8 8.6 9.6 7 12 7C14.4 7 16 8.7 16 11.1C16 14.8 14.8 17.2 13.4 19.3"
        stroke="#87A6CE"
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      <Path
        d="M10.2 12C10.2 10.8 10.9 10 12 10C13.2 10 13.8 10.9 13.8 12.1C13.8 14.3 13.2 16.1 12 18"
        stroke="#87A6CE"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ProfileIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={8}
        r={3}
        stroke={COLORS.navy}
        strokeWidth={1.5}
      />

      <Path
        d="M6 19C6.4 15.8 8.4 14 12 14C15.6 14 17.6 15.8 18 19"
        stroke={COLORS.navy}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function NotificationIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 9C18 5.7 15.3 3 12 3C8.7 3 6 5.7 6 9C6 15 4 17 4 17H20C20 17 18 15 18 9Z"
        stroke={COLORS.navy}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      <Path
        d="M10 20H14"
        stroke={COLORS.navy}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6L15 12L9 18"
        stroke="#93A9C3"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingBottom: 18,
  },

  hero: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 26,
    paddingTop: 17,
    paddingBottom: 18,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 18,
  },

  brandName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },

  tradeMark: {
    fontSize: 18,
  },

  patientLabel: {
    color: '#90A9CA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 5,
  },

  greeting: {
    color: COLORS.white,
    fontSize: 28,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },

  heroCopy: {
    color: '#D1DCEB',
    fontSize: 14,
    lineHeight: 12,
    maxWidth: 300,
  },

  body: {
    paddingHorizontal: 12,
    paddingTop: 13,
  },

  guardianBanner: {
    backgroundColor: COLORS.softBlue,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 10,
  },

  guardianText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  allergyCard: {
    minHeight: 52,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 10,
  },

  allergyContent: {
    flex: 1,
  },

  allergyTitle: {
    color: COLORS.warningText,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 3,
  },

  allergySubtitle: {
    color: '#99714A',
    fontSize: 13,
  },

  recordCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,

    shadowColor: COLORS.navy,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 5,
  },

  recordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  recordBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  recordBrandText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },

  recordName: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 7,
  },

  recordId: {
    color: '#A7B9D1',
    fontSize: 14,
    marginBottom: 9,
  },

  recordDescription: {
    color: '#9FB2CB',
    fontSize: 12,
    lineHeight: 10.5,
    maxWidth: 245,
    marginBottom: 13,
  },

  shareButton: {
    height: 34,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareButtonText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '500',
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  actionCard: {
    width: '48.5%',
    minHeight: 78,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,

    shadowColor: '#12213A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  actionIconWrap: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 5,
  },

  actionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  actionSubtitle: {
    color: '#303B49',
    fontSize: 14,
    lineHeight: 10,
  },

  settingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 11,
    overflow: 'hidden',
    marginBottom: 10,

    shadowColor: '#12213A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },

  settingsRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  settingsIcon: {
    width: 29,
    height: 29,
    borderRadius: 7,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  settingsText: {
    flex: 1,
  },

  settingsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  settingsSubtitle: {
    color: '#2E3948',
    fontSize: 13,
    lineHeight: 10,
  },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 47,
  },

  demoFooter: {
    color: '#535B65',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
  },
});