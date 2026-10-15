import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from './TabIcons';
import { hapticFeedback } from '../utils/haptics';
import type { Tab } from '../data/types';

const TAB_ORDER: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'records', label: 'Records' },
  { key: 'care', label: 'Care' },
  { key: 'chat', label: 'Assistant' },
  { key: 'profile', label: 'You' },
];

interface TabBarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export function TabBar({
  active,
  onSelect,
}: TabBarProps) {
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(
    insets.bottom,
    Platform.OS === 'ios' ? 8 : 6,
  );

  return (
    <View
      style={[
        styles.outer,
        {
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <View style={styles.container}>
        {TAB_ORDER.map(({ key, label }) => {
          const isCurrent = active === key;

          const color = isCurrent
            ? '#082F67'
            : '#111827';

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityState={{
                selected: isCurrent,
              }}
              accessibilityLabel={label}
              onPress={() => {
                if (active !== key) {
                  hapticFeedback.selection();
                  onSelect(key);
                }
              }}
              style={styles.tabButton}
            >
              <View
                style={[
                  styles.iconContainer,
                  isCurrent &&
                    styles.iconContainerActive,
                ]}
              >
                <TabIcon
                  tab={key}
                  color={color}
                  weight={
                    isCurrent ? 2 : 1.6
                  }
                />
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  isCurrent &&
                    styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 5,
  },

  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,
    borderColor: '#E4E9F0',

    borderRadius: 24,

    paddingHorizontal: 5,
    paddingVertical: 4,

    shadowColor: '#0B2545',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  iconContainer: {
    width: 36,
    height: 28,
    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 1,
  },

  iconContainerActive: {
    backgroundColor: '#DCE5F2',
  },

  tabLabel: {
    color: '#161B22',
    fontSize: 7,
    fontWeight: '500',
    textAlign: 'center',
  },

  tabLabelActive: {
    color: '#082F67',
    fontWeight: '700',
  },
});