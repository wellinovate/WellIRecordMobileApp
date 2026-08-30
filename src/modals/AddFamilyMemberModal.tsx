import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { FormSelect } from '../components/FormSelect';
import { BLOOD_TYPES, GENDER_OPTIONS, GENOTYPES } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Other'];

export function AddFamilyMemberModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!state.showAddFamilyMember) return null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    hapticFeedback.light();
    try {
      await actions.addFamilyMember();
    } finally {
      setIsSubmitting(false);
    }
  };

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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          alwaysBounceVertical={true}
        >
          <Text style={styles.introText}>
            Add a dependent to manage their clinical records, vitals, and appointments as their legal guardian.
          </Text>

          <Text style={styles.fieldLabel}>Full Name *</Text>
          <TextInput
            value={state.newMemberName}
            onChangeText={actions.setNewMemberName}
            placeholder="e.g. Nia Nwosu"
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>Relationship *</Text>
          <View style={styles.relationshipRow}>
            {RELATIONSHIPS.map((r) => {
              const selected = state.newMemberRelationship === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    actions.setNewMemberRelationship(r);
                  }}
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
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.selectWrapper}>
            <FormSelect
              value={state.newMemberGender}
              onChange={actions.setNewMemberGender}
              options={GENDER_OPTIONS}
              placeholder="Select gender"
            />
          </View>

          <Text style={styles.fieldLabel}>Blood Type</Text>
          <View style={styles.selectWrapper}>
            <FormSelect
              value={state.newMemberBloodType}
              onChange={actions.setNewMemberBloodType}
              options={BLOOD_TYPES}
              placeholder="Select blood type"
            />
          </View>

          <Text style={styles.fieldLabel}>Genotype</Text>
          <View style={styles.selectWrapper}>
            <FormSelect
              value={state.newMemberGenotype}
              onChange={actions.setNewMemberGenotype}
              options={GENOTYPES}
              placeholder="Select genotype"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          >
            {isSubmitting ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.submitBtnText}>Adding to Vault...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Svg width={16} height={16} viewBox="0 0 20 20">
                  <Path
                    d="M10 3v14M3 10h14"
                    stroke="#ffffff"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={styles.submitBtnText}>Add Family Member</Text>
              </View>
            )}
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
    width: '100%',
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  introText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 16,
  },
  selectWrapper: {
    marginBottom: 16,
  },
  relationshipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
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
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  submitBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
