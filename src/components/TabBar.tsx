import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
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
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
      ]}
    >
      {TAB_ORDER.map(({ key, label }) => {
        const isCurrent = active === key;
        const color = isCurrent ? '#0EA5E9' : theme.muted;

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
            <TabIcon tab={key} color={color} weight={isCurrent ? 2.2 : 1.7} />
            <Text
              style={[
                styles.tabLabel,
                {
                  color,
                  fontWeight: isCurrent ? '700' : '500',
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
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 30,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10.5,
  },
});
