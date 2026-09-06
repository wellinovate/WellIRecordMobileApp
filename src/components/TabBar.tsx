import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { TabIcon } from './TabIcons';
import { hapticFeedback } from '../utils/haptics';
import type { Tab } from '../data/types';

const TAB_ORDER: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'records', label: 'Records' },
  { key: 'share', label: 'Share' },
  { key: 'care', label: 'Care' },
  { key: 'profile', label: 'Profile' },
];

interface TabBarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export function TabBar({ active, onSelect }: TabBarProps) {

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E4DFD1',
        },
      ]}
    >
      {TAB_ORDER.map(({ key, label }) => {
        const isCurrent = active === key;
        const color = isCurrent ? '#0B2545' : '#9AA3AF';

        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.7}
            onPress={() => {
              if (active !== key) {
                hapticFeedback.selection();
              }
              onSelect(key);
            }}
            style={styles.tabButton}
          >
            <View style={styles.iconWrap}>
              <TabIcon tab={key} color={color} weight={isCurrent ? 2.2 : 1.7} />
              {isCurrent && <View style={styles.activeIndicator} />}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color,
                  fontWeight: isCurrent ? '700' : '600',
                },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    zIndex: 30,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3E7CBF',
  },
  tabLabel: {
    fontSize: 10.5,
  },
});
