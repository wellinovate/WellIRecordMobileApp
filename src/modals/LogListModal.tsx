import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import type { LogEntry } from '../data/types';

interface LogListModalProps {
  title: string;
  intro?: string;
  entries: LogEntry[];
  onClose: () => void;
}

export function LogListModal({
  title,
  intro,
  entries,
  onClose,
}: LogListModalProps) {
  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader title={title} onClose={onClose} />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {intro ? <Text style={styles.introText}>{intro}</Text> : null}

          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
              <Text style={styles.emptyTitle}>No activity logged yet</Text>
              <Text style={styles.emptySub}>
                Your NDPR-compliant access history and audit events will appear here.
              </Text>
            </View>
          ) : (
            entries.map((a, i) => (
              <View key={i} style={styles.logCard}>
                <View style={styles.emojiBox}>
                  <Text style={{ fontSize: 15 }}>{a.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>{a.title}</Text>
                  <Text style={styles.logTime}>{a.time}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  introText: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginBottom: 6,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
  },
  emojiBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  logTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
