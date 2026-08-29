import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { SectionLabel, ToggleRow } from '../components/SettingsUI';
import type { WelliApp } from '../state/useWelliApp';

export function NotificationSettingsModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showNotificationSettings) return null;

  const pushDisabled = state.notifPermission !== 'granted';

  return (
    <Modal
      visible={state.showNotificationSettings}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeNotificationSettings}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Notifications"
          onClose={actions.closeNotificationSettings}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {pushDisabled && (
            <View style={styles.warningBanner}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 10a6 6 0 1112 0c0 3 1 4.5 2 5.5H4c1-1 2-2.5 2-5.5z"
                  stroke="#92582b"
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
                <Path
                  d="M9.5 18.5a2.5 2.5 0 005 0"
                  stroke="#92582b"
                  strokeWidth={1.7}
                />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>
                  Push notifications are off
                </Text>
                <Text style={styles.warningSub}>
                  Enable them to get access, appointment & record alerts.
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.enablePushNotifications}
              >
                <Text style={styles.enableLink}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}

          <SectionLabel>Alert Types</SectionLabel>
          <View style={styles.settingsBox}>
            <View style={styles.itemBorder}>
              <ToggleRow
                emoji="⏳"
                label="Access Expiring"
                sub="When someone's access to records is about to expire"
                on={state.notifyAccessExpiring}
                onClick={() => actions.toggleNotifyPref('notifyAccessExpiring')}
              />
            </View>
            <View style={styles.itemBorder}>
              <ToggleRow
                emoji="📅"
                label="Appointment Reminders"
                sub="Upcoming visits and telehealth calls"
                on={state.notifyAppointments}
                onClick={() => actions.toggleNotifyPref('notifyAppointments')}
              />
            </View>
            <View style={styles.itemBorder}>
              <ToggleRow
                emoji="🧾"
                label="New Records"
                sub="When a record is added or verified"
                on={state.notifyNewRecords}
                onClick={() => actions.toggleNotifyPref('notifyNewRecords')}
              />
            </View>
            <ToggleRow
              emoji="👪"
              label="Family Activity"
              sub="Actions taken by caregivers on your behalf"
              on={state.notifyFamilyActivity}
              onClick={() => actions.toggleNotifyPref('notifyFamilyActivity')}
            />
          </View>

          <SectionLabel>Delivery</SectionLabel>
          <View style={styles.settingsBox}>
            <ToggleRow
              emoji="✉️"
              label="Email Updates"
              sub="A weekly summary sent to your inbox"
              on={state.notifyEmailUpdates}
              onClick={() => actions.toggleNotifyPref('notifyEmailUpdates')}
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
  warningBanner: {
    borderRadius: 14,
    backgroundColor: '#fdf4ec',
    borderWidth: 1,
    borderColor: '#f3dcc4',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92582b',
  },
  warningSub: {
    fontSize: 12,
    color: '#92582b',
    opacity: 0.9,
    marginTop: 1,
  },
  enableLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  settingsBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 22,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
});
