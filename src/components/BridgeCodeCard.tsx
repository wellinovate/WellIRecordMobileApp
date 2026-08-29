import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface BridgeCodeCardProps {
  code: string;
  link: string;
  size?: number;
}

export function BridgeCodeCard({ code, link, size = 168 }: BridgeCodeCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={`https://${link}`}
          size={size}
          color="#041E42"
          backgroundColor="#ffffff"
        />
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.codeText}>{code}</Text>
        <Text style={styles.linkText}>{link}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 14,
  },
  qrWrapper: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  textWrapper: {
    alignItems: 'center',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#0f172a',
  },
  linkText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
});
