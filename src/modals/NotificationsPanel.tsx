import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';

export function NotificationsPanel({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  if (!state.showNotifications) return null;

  return (
    <Modal
      visible={state.showNotifications}
      transparent
      animationType="fade"
      onRequestClose={actions.closeNotifications}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={actions.closeNotifications}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.panel,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.closeNotifications}
              style={[styles.headerBtn, { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}
              accessibilityLabel="Back to previous page"
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

            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Notifications
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={actions.closeNotifications}
              style={[styles.headerBtn, { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]}
              accessibilityLabel="Close notifications"
            >
              <Svg width={14} height={14} viewBox="0 0 20 20">
                <Path
                  d="M4 4l12 12M16 4L4 16"
                  stroke={theme.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>

          {state.notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.mutedLight }]}>
                You're all caught up.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }}>
              {state.notifications.map((n) => (
                <View
                  key={n.id}
                  style={[
                    styles.notifRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View
                    style={[styles.emojiCircle, { backgroundColor: n.tint }]}
                  >
                    <Text style={{ fontSize: 15 }}>{n.emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>
                      {n.title}
                    </Text>
                    <Text style={[styles.notifDesc, { color: theme.muted }]}>
                      {n.desc}
                    </Text>
                    <Text
                      style={[styles.notifTime, { color: theme.mutedLight }]}
                    >
                      {n.time}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => actions.dismissNotification(n.id)}
                    style={styles.dismissBtn}
                  >
                    <Svg width={12} height={12} viewBox="0 0 20 20">
                      <Path
                        d="M4 4l12 12M16 4L4 16"
                        stroke={theme.mutedLight}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 64,
    paddingHorizontal: 16,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  emojiCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  notifDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10.5,
    marginTop: 4,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
