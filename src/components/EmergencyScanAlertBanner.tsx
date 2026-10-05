import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { notificationService, EmergencyScanAlert } from '../services/notificationService';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function EmergencyScanAlertBanner({ app }: { app: WelliApp }) {
  const [alert, setAlert] = useState<EmergencyScanAlert | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokedSuccess, setRevokedSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToAlerts((incomingAlert) => {
      setAlert(incomingAlert);
      if (incomingAlert) {
        hapticFeedback.warning();
      }
    });

    return () => unsubscribe();
  }, []);

  if (!alert && !revokedSuccess) {
    return null;
  }

  const handleRevoke = async () => {
    if (!alert?.token) {
      handleDismiss();
      return;
    }
    setIsRevoking(true);
    hapticFeedback.medium();

    try {
      await notificationService.revokeEmergencyToken(alert.token);
      setIsRevoking(false);
      setRevokedSuccess(true);
      hapticFeedback.success();

      setTimeout(() => {
        setRevokedSuccess(false);
        setAlert(null);
      }, 4000);
    } catch (e) {
      setIsRevoking(false);
      setAlert(null);
    }
  };

  const handleDismiss = () => {
    hapticFeedback.selection();
    notificationService.dismissActiveAlert();
    setAlert(null);
  };

  const handleViewLog = () => {
    hapticFeedback.selection();
    app.actions.openEmergency();
  };

  if (revokedSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <View style={styles.rowTop}>
            <View style={styles.successBadge}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  stroke="#059669"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.successBadgeText}>Emergency Link Revoked & Locked</Text>
            </View>
          </View>
          <Text style={styles.successDesc}>
            The emergency QR code has been permanently invalidated. No first responder can scan or read your records with that link anymore.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.alertCard}>
        {/* Header Badge */}
        <View style={styles.rowTop}>
          <View style={styles.beaconBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.beaconText}>FIRST RESPONDER ACCESS DETECTED</Text>
          </View>
          <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.dismissBtn}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#991b1b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Text style={styles.titleText}>🚨 Emergency Medical ID QR Scanned</Text>
        <Text style={styles.descText}>
          Your emergency medical profile was just accessed via WelliBridge QR scan.
          {alert?.ipAddress ? ` Source: ${alert.ipAddress}` : ''}
        </Text>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewLog} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleRevoke} disabled={isRevoking} style={styles.btnRevoke}>
            {isRevoking ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.btnRevokeText}>Revoke Link Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  alertCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fda4af',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  beaconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#e11d48',
    marginRight: 6,
  },
  beaconText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#9f1239',
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#881337',
    marginBottom: 2,
  },
  descText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#9f1239',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9f1239',
  },
  btnRevoke: {
    flex: 1,
    backgroundColor: '#e11d48',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRevokeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  successDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: '#047857',
    marginTop: 4,
  },
});
