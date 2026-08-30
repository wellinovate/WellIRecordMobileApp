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
import Svg, { Path, Circle } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { FormSelect } from '../components/FormSelect';
import { Avatar } from '../components/Avatar';
import { BLOOD_TYPES, GENDER_OPTIONS, GENOTYPES } from '../data/mockData';
import { formatDob } from '../utils/formatDate';
import {
  pickImageFromCamera,
  pickImageFromLibrary,
} from '../utils/mediaPicker';
import { hapticFeedback } from '../utils/haptics';
import type { FamilyMember } from '../data/types';
import type { WelliApp } from '../state/useWelliApp';

type EditableKey = Exclude<
  keyof FamilyMember,
  'id' | 'role' | 'initials' | 'avatarUrl'
>;

type FieldDef =
  | { key: EditableKey; label: string; type: 'text' }
  | { key: 'dob'; label: string; type: 'date' }
  | {
      key: 'gender' | 'bloodType' | 'genotype';
      label: string;
      type: 'select';
      options: string[];
    };

const EDITABLE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Full Name', type: 'text' },
  { key: 'dob', label: 'Date of Birth (YYYY-MM-DD)', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS },
  { key: 'bloodType', label: 'Blood Type', type: 'select', options: BLOOD_TYPES },
  { key: 'genotype', label: 'Genotype', type: 'select', options: GENOTYPES },
  { key: 'height', label: 'Height', type: 'text' },
  { key: 'weight', label: 'Weight', type: 'text' },
  { key: 'allergies', label: 'Allergies', type: 'text' },
  { key: 'conditions', label: 'Conditions', type: 'text' },
  { key: 'contact', label: 'Emergency Contact', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'insuranceProvider', label: 'Insurance Provider', type: 'text' },
  { key: 'insuranceId', label: 'Insurance ID', type: 'text' },
];

export function PersonalInfoModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  if (!state.showPersonalInfo) return null;

  const activeMember =
    family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';
  const editing = state.personalInfoEditMode;
  const draft = state.personalInfoDraft;

  const displayFields = [
    { label: 'Full Name', value: activeMember.name || 'Not set' },
    { label: 'Date of Birth', value: formatDob(activeMember.dob) },
    { label: 'Gender', value: activeMember.gender || 'Not set' },
    { label: 'Blood Type', value: activeMember.bloodType || 'Not set' },
    { label: 'Genotype', value: activeMember.genotype || 'Not set' },
    {
      label: 'Height / Weight',
      value:
        activeMember.height || activeMember.weight
          ? `${activeMember.height || '—'} / ${activeMember.weight || '—'}`
          : 'Not set',
    },
    { label: 'Allergies', value: activeMember.allergies || 'None on file' },
    { label: 'Conditions', value: activeMember.conditions || 'None on file' },
    { label: 'Emergency Contact', value: activeMember.contact || 'Not set' },
    { label: 'Email', value: activeMember.email || 'Not set' },
    { label: 'Phone', value: activeMember.phone || 'Not set' },
    { label: 'Address', value: activeMember.address || 'Not set' },
    { label: 'Insurance Provider', value: activeMember.insuranceProvider || 'Not set' },
    { label: 'Insurance ID', value: activeMember.insuranceId || 'Not set' },
  ];

  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    setPickingPhoto(true);
    hapticFeedback.light();
    const result = await pickImageFromCamera();
    setPickingPhoto(false);
    if (result) {
      hapticFeedback.success();
      actions.setAvatar(activeMember.id, result.uri, result.size || 1024);
    }
  };

  const handlePickLibrary = async () => {
    setShowPhotoOptions(false);
    setPickingPhoto(true);
    hapticFeedback.light();
    const result = await pickImageFromLibrary();
    setPickingPhoto(false);
    if (result) {
      hapticFeedback.success();
      actions.setAvatar(activeMember.id, result.uri, result.size || 1024);
    }
  };

  const handleRemovePhoto = () => {
    setShowPhotoOptions(false);
    hapticFeedback.warning();
    actions.removeAvatar(activeMember.id);
  };

  return (
    <Modal
      visible={state.showPersonalInfo}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closePersonalInfo}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={isGuardianView ? `${activeMember.name}'s Info` : 'Personal Info'}
          onClose={actions.closePersonalInfo}
          onBack={editing ? actions.cancelEditPersonalInfo : actions.closePersonalInfo}
        />

        <View style={styles.editTopRow}>
          {!editing && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.selection();
                actions.startEditPersonalInfo();
              }}
            >
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar member={activeMember} size={84} fontSize={26} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.light();
                  setShowPhotoOptions(true);
                }}
                style={styles.cameraIconBtn}
              >
                {pickingPhoto ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 8a2 2 0 012-2h1.2l.8-1.5A1 1 0 018.9 4h6.2a1 1 0 01.9.5L16.8 6H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                      stroke="#ffffff"
                      strokeWidth={1.7}
                      strokeLinejoin="round"
                    />
                    <Circle
                      cx={12}
                      cy={13}
                      r={3.2}
                      stroke="#ffffff"
                      strokeWidth={1.7}
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            </View>
            {activeMember.avatarUrl ? (
              <TouchableOpacity onPress={handleRemovePhoto}>
                <Text style={styles.removePhotoText}>Remove Photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isGuardianView && (
            <View style={styles.guardianNotice}>
              <Text style={styles.guardianNoticeText}>
                Viewing as guardian. Some fields may be limited for dependents.
              </Text>
            </View>
          )}

          {editing && draft ? (
            <View style={styles.editForm}>
              {EDITABLE_FIELDS.map((f) => (
                <View key={f.key} style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  {f.type === 'select' ? (
                    <FormSelect
                      value={draft[f.key] as string}
                      onChange={(v) => {
                        hapticFeedback.selection();
                        actions.updatePersonalInfoDraft(f.key, v);
                      }}
                      options={f.options}
                    />
                  ) : (
                    <TextInput
                      value={draft[f.key] as string}
                      onChangeText={(v) =>
                        actions.updatePersonalInfoDraft(f.key, v)
                      }
                      style={styles.formInput}
                    />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.displayCard}>
              {displayFields.map((f, i) => (
                <View
                  key={f.label}
                  style={[
                    styles.displayRow,
                    {
                      borderBottomWidth:
                        i === displayFields.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  <Text style={styles.rowValue}>{f.value || '—'}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {editing && (
          <View style={styles.footerBtns}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.light();
                actions.cancelEditPersonalInfo();
              }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                hapticFeedback.success();
                actions.savePersonalInfo();
              }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Photo Options Modal */}
        <Modal
          visible={showPhotoOptions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPhotoOptions(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPhotoOptions(false)}
          >
            <View style={styles.optionsCard}>
              <Text style={styles.optionsHeader}>Change Profile Photo</Text>

              <TouchableOpacity
                style={styles.optionRow}
                onPress={handleTakePhoto}
              >
                <Text style={styles.optionEmoji}>📸</Text>
                <Text style={styles.optionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionRow}
                onPress={handlePickLibrary}
              >
                <Text style={styles.optionEmoji}>🖼️</Text>
                <Text style={styles.optionText}>Choose from Library</Text>
              </TouchableOpacity>

              {activeMember.avatarUrl && (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={handleRemovePhoto}
                >
                  <Text style={styles.optionEmoji}>🗑️</Text>
                  <Text style={[styles.optionText, { color: '#dc2626' }]}>
                    Remove Current Photo
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.optionRow, styles.cancelOptionRow]}
                onPress={() => setShowPhotoOptions(false)}
              >
                <Text style={styles.cancelOptionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  editTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  editActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraIconBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#041E42',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  guardianNotice: {
    backgroundColor: '#fdf4ec',
    borderWidth: 1,
    borderColor: '#f3dcc4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  guardianNoticeText: {
    fontSize: 12,
    color: '#92582b',
  },
  editForm: {
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  formInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  displayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
  },
  displayRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: '#e2e8f0',
  },
  rowLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 34,
  },
  optionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  optionsHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  optionEmoji: {
    fontSize: 18,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  cancelOptionRow: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
});
