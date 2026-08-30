import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { Avatar } from '../components/Avatar';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

export function FamilyAccessModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showFamilyAccess) return null;

  const owner = family.find((f) => f.role === 'owner') || family[0];
  const dependents = family.filter((f) => f.role === 'dependent' && f.id !== 'me');

  const handleDelete = (id: string, name: string) => {
    hapticFeedback.warning();
    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${name} from your managed family vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => actions.removeFamilyMember(id),
        },
      ]
    );
  };

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
          showsVerticalScrollIndicator={true}
          alwaysBounceVertical={true}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              hapticFeedback.light();
              actions.openAddFamilyMember();
            }}
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

          {/* Primary Owner Card */}
          <Text style={styles.sectionHeader}>Account Owner</Text>
          <View style={styles.memberCard}>
            <Avatar member={owner} size={44} fontSize={16} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{owner.name}</Text>
              <Text style={styles.memberSub}>Full access to your own records</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: '#0284c7' }]}>
              <Text style={styles.roleBadgeText}>Primary</Text>
            </View>
          </View>

          {/* Dependents List */}
          <Text style={styles.sectionHeader}>Managed Dependents ({dependents.length})</Text>
          {dependents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No dependents added yet</Text>
              <Text style={styles.emptySub}>
                Add family members (children, parents, spouse) to view, store, and manage their clinical records as their guardian.
              </Text>
            </View>
          ) : (
            dependents.map((f) => (
              <View key={f.id} style={styles.memberCard}>
                <Avatar member={f} size={44} fontSize={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{f.name}</Text>
                  <Text style={styles.memberSub}>
                    {f.relationship || 'Dependent'} • Guardian Managed
                  </Text>
                  {f.dob ? <Text style={styles.memberDob}>DOB: {f.dob}</Text> : null}
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDelete(f.id, f.name)}
                  style={styles.removeBtn}
                  accessibilityLabel={`Remove ${f.name}`}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"
                      stroke="#dc2626"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={styles.disclaimer}>
            Guardian access gives you legal authority to manage clinical records, share encrypted consent passes, and coordinate HMO benefits on behalf of your dependents.
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
    width: '100%',
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
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
    marginBottom: 10,
    shadowColor: '#041e42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  memberCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  memberDob: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 11.5,
    color: '#94a3b8',
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
});
