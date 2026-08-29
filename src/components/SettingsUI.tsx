import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.sectionLabel}>
      {children}
    </Text>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <Switch
      value={on}
      onValueChange={onClick}
      trackColor={{ false: '#cbd5e1', true: '#0EA5E9' }}
      thumbColor="#ffffff"
      ios_backgroundColor="#cbd5e1"
    />
  );
}

export function Row({
  emoji,
  label,
  sub,
  onClick,
  danger,
}: {
  emoji: string;
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onClick}
      style={styles.row}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: '#dc2626' }]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {!danger && (
        <Svg width={14} height={14} viewBox="0 0 20 20">
          <Path
            d="M7 4l6 6-6 6"
            stroke="#94a3b8"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

export function ToggleRow({
  emoji,
  label,
  sub,
  on,
  onClick,
}: {
  emoji: string;
  label: string;
  sub?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Toggle on={on} onClick={onClick} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  emoji: {
    fontSize: 17,
    width: 26,
    textAlign: 'center',
    marginRight: 10,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
