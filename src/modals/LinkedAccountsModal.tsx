import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import { SectionLabel } from '../components/SettingsUI';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function LinkedAccountsModal({ app }: { app: WelliApp }) {
  const { state, actions, linkedAccountDefs } = app;
  if (!state.showLinkedAccounts) return null;

  const healthcare = linkedAccountDefs.filter(
    (a) => a.category === 'healthcare'
  );
  const signIn = linkedAccountDefs.filter((a) => a.category === 'signin');

  const renderGroup = (label: string, items: typeof linkedAccountDefs) => (
    <View style={{ marginBottom: 22 }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.groupCard}>
        {items.map((a, i) => {
          const connected = !!state.linkedAccounts[a.id];
          return (
            <View
              key={a.id}
              style={[
                styles.accountRow,
                {
                  borderBottomWidth:
                    i === items.length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 16 }}>{a.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text style={styles.accountSub}>{a.sub}</Text>
              </View>
              {connected ? (
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.success();
                    actions.connectAccount(a.id, a.name);
                  }}
                >
                  <Text style={styles.connectLink}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={state.showLinkedAccounts}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeLinkedAccounts}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Linked Accounts"
          onClose={actions.closeLinkedAccounts}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <Text style={styles.introText}>
            Connect accounts to speed up refills, claims, and sign-in.
          </Text>
          {renderGroup('Healthcare Accounts', healthcare)}
          {renderGroup('Sign-In Methods', signIn)}
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
  },
  introText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomColor: '#e2e8f0',
  },
  emojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  accountSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  connectedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  connectLink: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0EA5E9',
  },
});
