import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { offlineSyncService } from '../services/offlineSyncService';
import { hapticFeedback } from '../utils/haptics';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}

export function OfflineSyncBanner() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: offlineSyncService.isOnline(),
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
  });
  const [showSyncedSuccess, setShowSyncedSuccess] = useState(false);

  useEffect(() => {
    let lastPending = 0;
    const unsubscribe = offlineSyncService.subscribe((newStatus) => {
      // If we just finished syncing pending items, briefly show a success confirmation
      if (lastPending > 0 && newStatus.pendingCount === 0 && !newStatus.isSyncing) {
        setShowSyncedSuccess(true);
        setTimeout(() => setShowSyncedSuccess(false), 3500);
      }
      lastPending = newStatus.pendingCount;
      setStatus(newStatus);
    });

    return () => unsubscribe();
  }, []);

  const handleManualSync = () => {
    hapticFeedback.medium();
    offlineSyncService.processQueue();
  };

  // If online, not syncing, no pending items, and not showing success, render nothing
  if (status.isOnline && !status.isSyncing && status.pendingCount === 0 && !showSyncedSuccess) {
    return null;
  }

  return (
    <View style={styles.container}>
      {!status.isOnline ? (
        <View style={styles.offlineCard}>
          <View style={styles.leftRow}>
            <View style={styles.iconCircleAmber}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M2 2l20 20M8.5 8.5A5 5 0 0 1 12 7c2.76 0 5 2.24 5 5 0 .5-.08.97-.22 1.42M19.4 15a4 4 0 0 0-1.4-7.5M5.6 10.6A7 7 0 0 0 5 13a5 5 0 0 0 5 5h8a4.9 4.9 0 0 0 2-.4"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>Offline Mode Active</Text>
              <Text style={styles.offlineSub}>
                {status.pendingCount > 0
                  ? `${status.pendingCount} record change(s) queued · Emergency QR offline ready`
                  : 'Emergency QR & Health Vault saved locally · Auto-syncs when reconnected'}
              </Text>
            </View>
          </View>
        </View>
      ) : status.isSyncing ? (
        <View style={styles.syncingCard}>
          <ActivityIndicator size="small" color="#0284c7" />
          <Text style={styles.syncingText}>
            Syncing {status.pendingCount > 0 ? `${status.pendingCount} pending update(s)` : 'changes'} with WelliCloud...
          </Text>
        </View>
      ) : showSyncedSuccess ? (
        <View style={styles.successCard}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17l-5-5"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.successText}>WelliCloud vault updated & synced</Text>
        </View>
      ) : status.pendingCount > 0 ? (
        <View style={styles.pendingCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>{status.pendingCount} item(s) pending sync</Text>
            <Text style={styles.pendingSub}>Ready to upload to your secure health cloud</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleManualSync}
            style={styles.syncNowBtn}
          >
            <Text style={styles.syncNowBtnText}>Sync Now</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 40,
  },
  offlineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleAmber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineTitle: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineSub: {
    color: '#cbd5e1',
    fontSize: 10.5,
    marginTop: 1,
  },
  syncingCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncingText: {
    color: '#0369a1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    color: '#065f46',
    fontSize: 11.5,
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pendingTitle: {
    color: '#1e293b',
    fontSize: 11.5,
    fontWeight: '700',
  },
  pendingSub: {
    color: '#64748b',
    fontSize: 10.5,
  },
  syncNowBtn: {
    backgroundColor: '#041E42',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncNowBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
