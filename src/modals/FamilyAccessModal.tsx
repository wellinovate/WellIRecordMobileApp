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
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { Avatar } from '../components/Avatar';
import type { WelliApp } from '../state/useWelliApp';

export function FamilyAccessModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showFamilyAccess) return null;

  const familyAccessView = family.map((f) => ({
    ...f,
    badge: f.role === 'owner' ? 'Account Owner' : 'Dependent',
    badgeColor: f.role === 'owner' ? '#0EA5E9' : '#c87941',
    sub:
      f.role === 'owner'
        ? 'Full access to your own records'
        : 'Managed by you as guardian',
  }));

  return (
    <Modal
      visible={state.showFamilyAccess}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeFamilyAccess}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Family & Caregiver Access"
          onClose={actions.closeFamilyAccess}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={actions.openAddFamilyMember}
            style={styles.addBtn}
          >
            <Svg width={16} height={16} viewBox="0 0 20 20">
              <Path
                d="M10 3v14M3 10h14"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.addBtnText}>Add Family Member</Text>
          </TouchableOpacity>

          {familyAccessView.map((f) => (
            <View key={f.id} style={styles.memberCard}>
              <Avatar member={f} size={42} fontSize={15} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{f.name}</Text>
                <Text style={styles.memberSub}>{f.sub}</Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: f.badgeColor },
                ]}
              >
                <Text style={styles.roleBadgeText}>{f.badge}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.disclaimer}>
            Guardian access can be transferred or revoked by contacting WelliRecord support.
          </Text>
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
    gap: 12,
  },
  addBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  memberCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  memberSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
    lineHeight: 18,
  },
});
