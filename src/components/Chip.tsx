import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onClick}
      style={[
        styles.chip,
        {
          backgroundColor: active ? '#041E42' : theme.surface,
          borderColor: active ? '#041E42' : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: active ? '#ffffff' : theme.text,
            fontWeight: active ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
  },
});
