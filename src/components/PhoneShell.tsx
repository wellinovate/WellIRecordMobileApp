import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../theme/ThemeContext';

interface PhoneShellProps {
  children: React.ReactNode;
}

export function PhoneShell({ children }: PhoneShellProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const isDesktopWeb = Platform.OS === 'web' && width > 520;

  if (isDesktopWeb) {
    return (
      <View style={styles.webOuter}>
        <View
          style={[
            styles.phoneCard,
            {
              backgroundColor: theme.bg,
              borderColor: theme.darkMode ? '#334155' : '#e2e8f0',
            },
          ]}
        >
          {/* Simulated Mobile Status Bar on Web */}
          <View style={styles.webStatusBar}>
            <View style={styles.dynamicIsland} />
          </View>
          <View style={styles.innerContent}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.nativeContainer, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.darkMode ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    backgroundColor: '#070f1e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  phoneCard: {
    width: '100%',
    maxWidth: 420,
    height: 860,
    maxHeight: '94%' as unknown as number,
    borderRadius: 44,
    borderWidth: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
    elevation: 20,
    position: 'relative',
  },
  webStatusBar: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  dynamicIsland: {
    width: 100,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#000000',
    marginTop: 4,
  },
  innerContent: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  nativeContainer: {
    flex: 1,
    position: 'relative',
  },
});
