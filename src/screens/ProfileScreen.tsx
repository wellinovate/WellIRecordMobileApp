import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Avatar } from '../components/Avatar';
import { LogoMark } from '../components/Logo';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const COLORS = {
  navy: '#082F67',
  navyDark: '#06285A',
  navyMid: '#244A7D',

  white: '#FFFFFF',
  background: '#F7F9FC',

  text: '#102D56',
  muted: '#68788C',
  subtle: '#91A0B2',

  border: '#E4E9F0',
  softBlue: '#EEF3FA',

  green: '#19A463',
};

type RowIcon =
  | 'person'
  | 'contact'
  | 'emergency'
  | 'health'
  | 'membership'
  | 'language'
  | 'verify'
  | 'password'
  | 'privacy';

export function ProfileScreen({
  app,
}: {
  app: WelliApp;
}) {
  const { state, actions, family } = app;

  const owner =
    family.find((member) => member.role === 'owner') ??
    family[0];

  const dependentCount = family.filter(
    (member) => member.role === 'dependent' && member.id !== 'me',
  ).length;

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  if (!owner) {
    return null;
  }

  const ownerName =
    owner.name || 'WelliRecord Patient';

  const recordId =
    owner.wrId || 'Not assigned yet';

  const handleNotificationToggle = (
    value: boolean,
  ) => {
    hapticFeedback.selection();
    setNotificationsEnabled(value);

    actions.showToast(
      value
        ? 'In-app notifications enabled'
        : 'In-app notifications disabled',
    );
  };

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
        {/* =========================
            TOP HEADER
        ========================== */}
        <View style={styles.headerTop}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={
              state.tabHistory.length > 0
                ? actions.goBackTab
                : () => actions.setTab('home')
            }
            style={styles.backButton}
          >
            <Svg
              width={28}
              height={28}
              viewBox="0 0 24 24"
              fill="none"
            >
              <Path
                d="M15 18L9 12L15 6"
                stroke="#172033"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.headerBrand}>
            WelliRecord
            <Text style={styles.tm}>™</Text>
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* =========================
            HERO
        ========================== */}
        <View style={styles.hero}>
          <View style={styles.heroBrandRow}>
            <LogoMark
              size={27}
              shieldColor="#FFFFFF"
              markColor={COLORS.navy}
              strokeColor="#FFFFFF"
            />

            <View>
              <Text style={styles.heroBrand}>
                WelliRecord
                <Text style={styles.heroTm}>™</Text>
              </Text>

              <Text style={styles.heroTagline}>
                One patient. One trusted record.
                Accessible when it matters.
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Your profile
          </Text>

          <Text style={styles.heroSubtitle}>
            Your details, your preferences, your account.
          </Text>
        </View>

        {/* =========================
            IDENTITY CARD
        ========================== */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={actions.openPersonalInfo}
          style={styles.identityCard}
        >
          <Avatar
            member={owner}
            size={34}
            fontSize={12}
          />

          <View style={styles.identityText}>
            <Text style={styles.identityName}>
              {ownerName}
            </Text>

            <Text style={styles.identityId}>
              WelliID · {recordId}
            </Text>

            <Text style={styles.identityHint}>
              Your record identity · update all profile details
            </Text>
          </View>

          <Chevron light />
        </TouchableOpacity>

        {/* =========================
            PERSONAL DETAILS
        ========================== */}
        <SectionCard title="Personal details">
          <SettingsRow
            icon="person"
            title="Legal & preferred name, DOB"
            subtitle="Review identity information"
            onPress={actions.openPersonalInfo}
          />

          <Divider />

          <SettingsRow
            icon="contact"
            title="Email, phone & address"
            subtitle="Residential address is optional"
            onPress={actions.openPersonalInfo}
          />

          <Divider />

          <SettingsRow
            icon="emergency"
            title="Emergency contact"
            subtitle="Not added"
            onPress={actions.openPersonalInfo}
          />

          <Divider />

          <SettingsRow
            icon="health"
            title="Health history"
            subtitle="Allergies, conditions, medicines, records & vitals"
            onPress={actions.openHealthHistory}
          />

          <Divider />

          <SettingsRow
            icon="person"
            title="Family and children"
            subtitle={
              dependentCount > 0
                ? `${dependentCount} ${dependentCount === 1 ? 'person' : 'people'} · child health profiles, guardians, vaccines`
                : 'Add a child or dependant, or enter an invite code'
            }
            onPress={actions.openFamilyAccess}
          />

          <Divider />

          <SettingsRow
            icon="verify"
            title="Share with a provider"
            subtitle="Link or QR code for a doctor not on WelliRecord. Expires, needs a code"
            onPress={actions.openProviderShare}
          />

          <Divider />

          <SettingsRow
            icon="verify"
            title="Website account"
            subtitle="Link your WelliRecord website account to see website video visits here"
            onPress={actions.openWebLink}
          />

          <Divider />

          <SettingsRow
            icon="verify"
            title="Link hospital records"
            subtitle="A hospital sent you a link to bring your records into WelliRecord"
            onPress={actions.openRecordLink}
          />

          <Divider />

          <SettingsRow
            icon="membership"
            title="WelliPay"
            subtitle="Bills, wallet and payments"
            onPress={actions.openBilling}
          />

          <Divider />

          <SettingsRow
            icon="membership"
            title="HMO and coverage"
            subtitle="Policies, pre-authorisation and family funding"
            onPress={actions.openCoverage}
          />
        </SectionCard>

        {/* =========================
            PREFERENCES
        ========================== */}
        <SectionCard title="Preferences">
          <SettingsRow
            icon="language"
            title="Language"
            subtitle="English · interface preference"
            onPress={() => {
              hapticFeedback.selection();
              actions.showToast(
                'Language preferences will open here',
              );
            }}
          />

          <Divider />

          <View style={styles.switchRow}>
            <View style={styles.rowIcon}>
              <NotificationIcon />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                In-app notifications
              </Text>

              <Text style={styles.rowSubtitle}>
                General app updates
              </Text>

              <Text style={styles.rowSupporting}>
                This preference does not control calls,
                medication or appointment alerts.
              </Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: '#CBD5E1',
                true: COLORS.green,
              }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#CBD5E1"
              style={styles.switch}
            />
          </View>
        </SectionCard>

        {/* =========================
            ACCOUNT & PRIVACY
        ========================== */}
        <SectionCard title="Account & privacy">
          <SettingsRow
            icon="verify"
            title="Email & phone verification"
            subtitle="View or change your email and phone number"
            onPress={actions.openPersonalInfo}
          />

          <Divider />

          <SettingsRow
            icon="password"
            title="Password & sessions"
            subtitle="Manage password and signed-in devices"
            onPress={actions.openPrivacySecurity}
          />

          <Divider />

          <SettingsRow
            icon="privacy"
            title="Privacy Policy & Terms"
            subtitle="Understand how your information is handled"
            onPress={actions.openPrivacySecurity}
          />
        </SectionCard>

        {/* =========================
            SIGN OUT
        ========================== */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            hapticFeedback.light();
            actions.logOut();
          }}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>
            Sign out
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

/* =========================================================
   SECTION
========================================================= */

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
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
  icon: RowIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => {
        hapticFeedback.selection();
        onPress();
      }}
      style={styles.row}
    >
      <View style={styles.rowIcon}>
        <RowIconView type={icon} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Chevron />
    </TouchableOpacity>
  );
}

function Divider() {
  return (
    <View style={styles.divider} />
  );
}

/* =========================================================
   ICONS
========================================================= */

function RowIconView({
  type,
}: {
  type: RowIcon;
}) {
  const stroke = COLORS.navy;

  if (type === 'person') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle
          cx={12}
          cy={8}
          r={3}
          stroke={stroke}
          strokeWidth={1.5}
        />

        <Path
          d="M6 19C6.4 15.8 8.4 14 12 14C15.6 14 17.6 15.8 18 19"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'contact') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 6H20V18H4V6Z"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        <Path
          d="M5 8L12 13L19 8"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'emergency') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        <Path
          d="M12 8V15M8.5 11.5H15.5"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'health') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 20S5 16.3 5 10.3C5 7.8 6.7 6 9 6C10.4 6 11.3 6.8 12 7.8C12.7 6.8 13.6 6 15 6C17.3 6 19 7.8 19 10.3C19 16.3 12 20 12 20Z"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (type === 'membership') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect
          x={4}
          y={6}
          width={16}
          height={12}
          rx={2}
          stroke={stroke}
          strokeWidth={1.5}
        />

        <Path
          d="M4 10H20"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </Svg>
    );
  }

  if (type === 'language') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle
          cx={12}
          cy={12}
          r={8}
          stroke={stroke}
          strokeWidth={1.5}
        />

        <Path
          d="M4 12H20M12 4C14 6.2 15 8.8 15 12C15 15.2 14 17.8 12 20M12 4C10 6.2 9 8.8 9 12C9 15.2 10 17.8 12 20"
          stroke={stroke}
          strokeWidth={1.3}
        />
      </Svg>
    );
  }

  if (type === 'verify') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle
          cx={12}
          cy={12}
          r={8}
          stroke={stroke}
          strokeWidth={1.5}
        />

        <Path
          d="M8.5 12L11 14.5L15.5 9.5"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (type === 'password') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 10V8C7 5.2 9.2 3 12 3C14.8 3 17 5.2 17 8V10"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        <Rect
          x={5}
          y={10}
          width={14}
          height={10}
          rx={2}
          stroke={stroke}
          strokeWidth={1.5}
        />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3L19 6V11C19 15.4 16.2 19 12 21C7.8 19 5 15.4 5 11V6L12 3Z"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
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

function Chevron({
  light = false,
}: {
  light?: boolean;
}) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6L15 12L9 18"
        stroke={
          light
            ? '#AFC4DF'
            : '#8EA5C0'
        }
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
    paddingBottom: 22,
  },

  headerTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: '#FFFFFF',

    paddingHorizontal: 18,
  },

  backButton: {
    width: 41,
    height: 41,

    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#F7F8FA',
  },

  headerBrand: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },

  tm: {
    fontSize: 18,
  },

  headerSpacer: {
    width: 31,
  },

  hero: {
    backgroundColor: COLORS.navy,

    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },

  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 7,

    marginBottom: 10,
  },

  heroBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  heroTm: {
    fontSize: 18,
  },

  heroTagline: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 1,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 24,
    fontWeight: '900',

    marginBottom: 3,
  },

  heroSubtitle: {
    color: '#BECDE0',
    fontSize: 14,
  },

  identityCard: {
    marginHorizontal: 14,
    marginTop: 9,
    marginBottom: 10,

    backgroundColor: COLORS.navy,

    borderRadius: 10,

    paddingHorizontal: 11,
    paddingVertical: 10,

    flexDirection: 'row',
    alignItems: 'center',
  },

  identityText: {
    flex: 1,
    marginLeft: 8,
  },

  identityName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  identityId: {
    color: '#B5C7DE',
    fontSize: 12,
    marginTop: 2,
  },

  identityHint: {
    color: '#8FA7C5',
    fontSize: 12,
    marginTop: 5,
  },

  section: {
    marginHorizontal: 14,
    marginBottom: 9,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 9,

    shadowColor: '#12213A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,

    overflow: 'hidden',
  },

  row: {
    minHeight: 36,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  rowIcon: {
    width: 47,
    height: 47,

    borderRadius: 7,

    backgroundColor: COLORS.softBlue,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 8,
  },

  rowText: {
    flex: 1,
  },

  rowTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },

  rowSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  rowSupporting: {
    color: COLORS.subtle,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    maxWidth: 195,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 44,
  },

  switchRow: {
    minHeight: 62,

    flexDirection: 'row',
    alignItems: 'flex-start',

    paddingHorizontal: 9,
    paddingVertical: 8,
  },

  switch: {
    transform: [
      { scaleX: 0.75 },
      { scaleY: 0.75 },
    ],
    marginTop: -3,
  },

  signOutButton: {
    marginHorizontal: 14,

    height: 37,

    backgroundColor: '#FFFFFF',

    borderRadius: 8,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 2,

    shadowColor: '#12213A',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  signOutText: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '500',
  },

  demoFooter: {
    color: '#747D88',
    fontSize: 12,
    textAlign: 'center',

    marginTop: 9,
  },
});