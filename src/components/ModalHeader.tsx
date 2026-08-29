import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hapticFeedback } from '../utils/haptics';

interface ModalHeaderProps {
  title: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  dark?: boolean;
  showBack?: boolean;
  showClose?: boolean;
}

function CircleButton({
  onClick,
  dark,
  children,
  accessibilityLabel,
}: {
  onClick: () => void;
  dark?: boolean;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        hapticFeedback.light();
        onClick();
      }}
      style={[
        styles.circleBtn,
        { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : '#f1f5f9' },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

export function ModalHeader({
  title,
  onClose,
  onBack,
  dark,
  showBack = true,
  showClose = true,
}: ModalHeaderProps) {
  const strokeColor = dark ? '#ffffff' : '#334155';
  const handleBack = onBack ?? onClose;

  return (
    <View style={styles.header}>
      {showBack ? (
        <CircleButton
          onClick={handleBack}
          dark={dark}
          accessibilityLabel="Go back to previous page"
        >
          <Svg width={14} height={14} viewBox="0 0 20 20">
            <Path
              d="M12 4l-6 6 6 6"
              stroke={strokeColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </CircleButton>
      ) : (
        <View style={{ width: 32 }} />
      )}

      <View style={styles.titleContainer}>
        {typeof title === 'string' ? (
          <Text
            style={[styles.title, { color: dark ? '#ffffff' : '#0f172a' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        ) : (
          title
        )}
      </View>

      {showClose ? (
        <CircleButton
          onClick={onClose}
          dark={dark}
          accessibilityLabel="Close"
        >
          <Svg width={14} height={14} viewBox="0 0 20 20">
            <Path
              d="M4 4l12 12M16 4L4 16"
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </CircleButton>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 10,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
