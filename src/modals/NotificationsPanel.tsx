import React, { useState } from 'react';
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
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';
import type { Notification, NotificationCategory } from '../data/types';

type FilterTab = 'all' | 'referral' | 'lab_result' | 'critical_alert' | 'consent';

export function NotificationsPanel({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  if (!state.showNotifications) return null;

  const notifications = state.notifications || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifs = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'referral') return n.type === 'referral';
    if (activeFilter === 'lab_result') return n.type === 'lab_result';
    if (activeFilter === 'critical_alert') return n.type === 'critical_alert';
    if (activeFilter === 'consent') return n.type === 'consent' || n.type === 'prescription' || n.type === 'immunization' || n.type === 'claim';
    return true;
  });

  const getCategoryTheme = (category?: NotificationCategory) => {
    switch (category) {
      case 'referral':
        return {
          badgeBg: theme.darkMode ? 'rgba(99, 102, 241, 0.18)' : '#EEF2FF',
          badgeText: '#4F46E5',
          border: theme.darkMode ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
          label: 'Specialist Referral',
        };
      case 'lab_result':
        return {
          badgeBg: theme.darkMode ? 'rgba(16, 185, 129, 0.18)' : '#ECFDF5',
          badgeText: '#059669',
          border: theme.darkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
          label: 'Verified Lab Result',
        };
      case 'critical_alert':
        return {
          badgeBg: theme.darkMode ? 'rgba(244, 63, 94, 0.18)' : '#FFF1F2',
          badgeText: '#E11D48',
          border: theme.darkMode ? 'rgba(244, 63, 94, 0.3)' : '#FECDD3',
          label: 'Emergency Alert',
        };
      case 'consent':
        return {
          badgeBg: theme.darkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
          badgeText: '#D97706',
          border: theme.darkMode ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
          label: 'Smart Consent',
        };
      case 'claim':
        return {
          badgeBg: theme.darkMode ? 'rgba(13, 148, 136, 0.18)' : '#F0FDFA',
          badgeText: '#0D9488',
          border: theme.darkMode ? 'rgba(13, 148, 136, 0.3)' : '#99F6E4',
          label: 'HMO Claim',
        };
      case 'immunization':
        return {
          badgeBg: theme.darkMode ? 'rgba(168, 85, 247, 0.18)' : '#FAF5FF',
          badgeText: '#9333EA',
          border: theme.darkMode ? 'rgba(168, 85, 247, 0.3)' : '#E9D5FF',
          label: 'Immunization',
        };
      default:
        return {
          badgeBg: theme.darkMode ? 'rgba(14, 165, 233, 0.18)' : '#F0F9FF',
          badgeText: '#0284C7',
          border: theme.darkMode ? 'rgba(14, 165, 233, 0.3)' : '#BAE6FD',
          label: 'Health Notification',
        };
    }
  };

  const getFilterCount = (tab: FilterTab) => {
    if (tab === 'all') return notifications.length;
    if (tab === 'referral') return notifications.filter((n) => n.type === 'referral').length;
    if (tab === 'lab_result') return notifications.filter((n) => n.type === 'lab_result').length;
    if (tab === 'critical_alert') return notifications.filter((n) => n.type === 'critical_alert').length;
    if (tab === 'consent') return notifications.filter((n) => n.type === 'consent' || n.type === 'prescription' || n.type === 'immunization' || n.type === 'claim').length;
    return 0;
  };

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
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.closeNotifications}
                style={[
                  styles.headerBtn,
                  { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' },
                ]}
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

              <View style={styles.titleWithBadge}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  Notifications
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.headerRightActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={actions.markAllNotificationsAsRead}
                  style={[styles.actionTextBtn, { borderColor: theme.border }]}
                >
                  <Text style={[styles.actionBtnText, { color: '#0EA5E9' }]}>
                    Mark read
                  </Text>
                </TouchableOpacity>
              )}

              {notifications.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={actions.clearAllNotifications}
                  style={[styles.actionTextBtn, { borderColor: theme.border }]}
                >
                  <Text style={[styles.actionBtnText, { color: theme.muted }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={actions.closeNotifications}
                style={[
                  styles.headerBtn,
                  { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' },
                ]}
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
          </View>

          {/* Category Filter Chips */}
          <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {[
                { key: 'all', label: 'All' },
                { key: 'referral', label: 'Referrals' },
                { key: 'lab_result', label: 'Lab Results' },
                { key: 'critical_alert', label: 'Alerts' },
                { key: 'consent', label: 'Care & Consent' },
              ].map((tab) => {
                const isSelected = activeFilter === tab.key;
                const count = getFilterCount(tab.key as FilterTab);
                return (
                  <TouchableOpacity
                    key={tab.key}
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticFeedback.selection();
                      setActiveFilter(tab.key as FilterTab);
                    }}
                    style={[
                      styles.filterChip,
                      isSelected
                        ? { backgroundColor: '#041E42', borderColor: '#041E42' }
                        : {
                            backgroundColor: theme.darkMode
                              ? 'rgba(255,255,255,0.05)'
                              : '#F8FAFC',
                            borderColor: theme.border,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: isSelected ? '#FFFFFF' : theme.muted },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.filterChipBadge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.25)'
                              : theme.darkMode
                              ? 'rgba(255,255,255,0.1)'
                              : '#E2E8F0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipBadgeText,
                            { color: isSelected ? '#FFFFFF' : theme.text },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Notification List */}
          {filteredNotifs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: theme.darkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                ]}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                    stroke={theme.mutedLight}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No notifications in this category
              </Text>
              <Text style={[styles.emptyText, { color: theme.mutedLight }]}>
                You are all caught up on your health records and provider updates.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {filteredNotifs.map((n: Notification) => {
                const catTheme = getCategoryTheme(n.type);
                const isUnread = !n.read;

                return (
                  <TouchableOpacity
                    key={n.id}
                    activeOpacity={0.88}
                    onPress={() => actions.handleNotificationAction(n)}
                    style={[
                      styles.notifRow,
                      {
                        borderBottomColor: theme.border,
                        backgroundColor: isUnread
                          ? theme.darkMode
                            ? 'rgba(14, 165, 233, 0.05)'
                            : '#F8FBFF'
                          : 'transparent',
                      },
                    ]}
                  >
                    {/* Left Icon Badge */}
                    <View style={[styles.emojiCircle, { backgroundColor: n.tint }]}>
                      <Text style={{ fontSize: 16 }}>{n.emoji}</Text>
                    </View>

                    {/* Content Column */}
                    <View style={{ flex: 1, paddingRight: 4 }}>
                      <View style={styles.notifTopRow}>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: catTheme.badgeBg,
                              borderColor: catTheme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.categoryBadgeText, { color: catTheme.badgeText }]}>
                            {n.categoryLabel || catTheme.label}
                          </Text>
                        </View>

                        <View style={styles.timeWithDot}>
                          {isUnread && <View style={styles.unreadDot} />}
                          <Text style={[styles.notifTime, { color: theme.mutedLight }]}>
                            {n.time}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.notifTitle,
                          {
                            color: theme.text,
                            fontWeight: isUnread ? '700' : '600',
                          },
                        ]}
                      >
                        {n.title}
                      </Text>

                      <Text style={[styles.notifDesc, { color: theme.muted }]}>
                        {n.desc}
                      </Text>

                      {/* Quick Action Button */}
                      {Boolean(n.actionLabel || n.targetTab || n.targetModal) && (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => actions.handleNotificationAction(n)}
                            style={[
                              styles.inlineActionBtn,
                              {
                                backgroundColor: theme.darkMode
                                  ? 'rgba(14, 165, 233, 0.15)'
                                  : '#F0F9FF',
                                borderColor: theme.darkMode
                                  ? 'rgba(14, 165, 233, 0.3)'
                                  : '#BAE6FD',
                              },
                            ]}
                          >
                            <Text style={styles.inlineActionText}>
                              {n.actionLabel || 'View Details'}
                            </Text>
                            <Svg width={12} height={12} viewBox="0 0 20 20" fill="none">
                              <Path
                                d="M7.5 5l5 5-5 5"
                                stroke="#0284C7"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Dismiss Button */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        actions.dismissNotification(n.id);
                      }}
                      style={[
                        styles.dismissBtn,
                        {
                          backgroundColor: theme.darkMode
                            ? 'rgba(255,255,255,0.06)'
                            : '#F1F5F9',
                        },
                      ]}
                      accessibilityLabel="Dismiss notification"
                    >
                      <Svg width={11} height={11} viewBox="0 0 20 20">
                        <Path
                          d="M4 4l12 12M16 4L4 16"
                          stroke={theme.mutedLight}
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                      </Svg>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingTop: 54,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  unreadPill: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterChipBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 42,
    paddingHorizontal: 24,
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
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  emojiCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
  },
  notifTitle: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  notifDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10.5,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineActionText: {
    color: '#0284C7',
    fontSize: 11.5,
    fontWeight: '700',
  },
  dismissBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});

