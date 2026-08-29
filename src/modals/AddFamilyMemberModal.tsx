import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { ModalHeader } from '../components/ModalHeader';
import { FormSelect } from '../components/FormSelect';
import { BLOOD_TYPES, GENDER_OPTIONS, GENOTYPES } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Other'];

export function AddFamilyMemberModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showAddFamilyMember) return null;

  return (
    <Modal
      visible={state.showAddFamilyMember}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeAddFamilyMember}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Add Family Member"
          onClose={actions.closeAddFamilyMember}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          <Text style={styles.introText}>
            Add a dependent to manage their records as their guardian.
          </Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            value={state.newMemberName}
            onChangeText={actions.setNewMemberName}
            placeholder="e.g. Nia Nwosu"
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Relationship</Text>
          <View style={styles.relationshipRow}>
            {RELATIONSHIPS.map((r) => {
              const selected = state.newMemberRelationship === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.7}
                  onPress={() => actions.setNewMemberRelationship(r)}
                  style={[
                    styles.relChip,
                    {
                      borderColor: selected ? '#041E42' : '#e2e8f0',
                      backgroundColor: selected ? '#041E42' : '#ffffff',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.relChipText,
                      { color: selected ? '#ffffff' : '#0f172a' },
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput
            value={state.newMemberDob}
            onChangeText={actions.setNewMemberDob}
            placeholder="e.g. 2018-05-12"
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={{ marginBottom: 20 }}>
            <FormSelect
              value={state.newMemberGender}
              onChange={actions.setNewMemberGender}
              options={GENDER_OPTIONS}
              placeholder="Select gender"
            />
          </View>

          <Text style={styles.fieldLabel}>Blood Type</Text>
          <View style={{ marginBottom: 20 }}>
            <FormSelect
              value={state.newMemberBloodType}
              onChange={actions.setNewMemberBloodType}
              options={BLOOD_TYPES}
              placeholder="Select blood type"
            />
          </View>

          <Text style={styles.fieldLabel}>Genotype</Text>
          <FormSelect
            value={state.newMemberGenotype}
            onChange={actions.setNewMemberGenotype}
            options={GENOTYPES}
            placeholder="Select genotype"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={actions.addFamilyMember}
            style={styles.submitBtn}
          >
            <Text style={styles.submitBtnText}>Add Family Member</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 24,
  },
  introText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 20,
  },
  relationshipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  relChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  relChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },
  submitBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
