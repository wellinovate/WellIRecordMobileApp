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
  | {
      key: EditableKey;
      label: string;
      type: 'text';
      placeholder?: string;
      keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      helper?: string;
    }
  | {
      key: 'dob';
      label: string;
      type: 'date';
      placeholder?: string;
      helper?: string;
    }
  | {
      key: 'gender' | 'bloodType' | 'genotype';
      label: string;
      type: 'select';
      options: string[];
      placeholder?: string;
      helper?: string;
    };

const EDITABLE_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'e.g. Chibuike Joshua Nwogha',
    autoCapitalize: 'words',
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    type: 'date',
    placeholder: 'YYYY-MM-DD (e.g. 1986-09-16)',
    helper: 'Format: YYYY-MM-DD',
  },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    options: ['Male', 'Female', 'Other'],
    placeholder: 'Select Gender',
  },
  {
    key: 'bloodType',
    label: 'Blood Type',
    type: 'select',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    placeholder: 'Select Blood Type',
  },
  {
    key: 'genotype',
    label: 'Genotype',
    type: 'select',
    options: ['AA', 'AS', 'SS', 'AC', 'SC'],
    placeholder: 'Select Genotype',
  },
  {
    key: 'height',
    label: 'Height',
    type: 'text',
    keyboardType: 'numeric',
    placeholder: 'e.g. 178 cm',
  },
  {
    key: 'weight',
    label: 'Weight',
    type: 'text',
    keyboardType: 'numeric',
    placeholder: 'e.g. 75 kg',
  },
  {
    key: 'allergies',
    label: 'Allergies',
    type: 'text',
    placeholder: 'e.g. Penicillin, Peanuts, None',
  },
  {
    key: 'conditions',
    label: 'Conditions & Chronic Diagnoses',
    type: 'text',
    placeholder: 'e.g. Hypertension, Asthma, None',
  },
  {
    key: 'contact',
    label: 'Emergency Contact & Next of Kin',
    type: 'text',
    placeholder: 'e.g. Next of Kin name & phone number',
  },
  {
    key: 'email',
    label: 'Email Address',
    type: 'text',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    placeholder: 'e.g. user@gmail.com',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    type: 'text',
    keyboardType: 'phone-pad',
    placeholder: 'e.g. 07030144923',
  },
  {
    key: 'address',
    label: 'Residential Address',
    type: 'text',
    placeholder: 'e.g. Admiralty Way, Lekki Phase 1, Lagos',
  },
  {
    key: 'insuranceProvider',
    label: 'HMO / Insurance Provider',
    type: 'text',
    placeholder: 'e.g. Hygeia HMO',
  },
  {
    key: 'insuranceId',
    label: 'HMO Policy / Enrollee ID',
    type: 'text',
    placeholder: 'e.g. HYG-992014-LAG',
  },
];

export function PersonalInfoModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (isSaving || !draft) return;
    setIsSaving(true);
    setSaveError(null);
    hapticFeedback.light();
    try {
      await actions.savePersonalInfo(draft);
      hapticFeedback.success();
    } catch (err: any) {
      hapticFeedback.error();
      setSaveError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSaveError(null);
    hapticFeedback.light();
    actions.cancelEditPersonalInfo();
  };

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
      onRequestClose={editing ? handleCancel : actions.closePersonalInfo}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={
            editing
              ? 'Edit Personal Info'
              : isGuardianView
              ? `${activeMember.name}'s Info`
              : 'Personal Info'
          }
          onClose={editing ? handleCancel : actions.closePersonalInfo}
          onBack={editing ? handleCancel : actions.closePersonalInfo}
        />

        {/* Top Action Subheader Row */}
        <View style={styles.topActionRow}>
          <View style={styles.subTextContainer}>
            <Text style={styles.sectionSubtitle}>
              {editing
                ? 'Update patient demographic and clinical parameters'
                : 'Verified health passport and cloud profile'}
            </Text>
          </View>

          {!editing && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                hapticFeedback.selection();
                setSaveError(null);
                actions.startEditPersonalInfo();
              }}
              style={styles.editPillBtn}
            >
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.editActionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar member={editing && draft ? draft : activeMember} size={84} fontSize={26} />
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

          {/* Error Banner when Save Fails */}
          {editing && saveError ? (
            <View style={styles.errorBanner}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={10} stroke="#dc2626" strokeWidth={2} />
                <Path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.errorBannerText}>{saveError}</Text>
            </View>
          ) : null}

          {/* Form / Read-only Fields */}
          {editing && draft ? (
            <View style={styles.editForm}>
              {EDITABLE_FIELDS.map((f) => {
                const rawVal = (draft[f.key] as string) || '';

                return (
                  <View key={f.key} style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      {f.helper ? (
                        <Text style={styles.fieldHelper}>{f.helper}</Text>
                      ) : null}
                    </View>

                    {f.type === 'select' ? (
                      <FormSelect
                        value={rawVal}
                        placeholder={f.placeholder || `Select ${f.label}`}
                        onChange={(v) => {
                          hapticFeedback.selection();
                          actions.updatePersonalInfoDraft(f.key, v);
                        }}
                        options={f.options}
                      />
                    ) : f.type === 'date' ? (
                      <View style={styles.dateInputWrapper}>
                        <TextInput
                          value={rawVal}
                          placeholder={f.placeholder || 'YYYY-MM-DD'}
                          placeholderTextColor="#94a3b8"
                          onChangeText={(v) =>
                            actions.updatePersonalInfoDraft(f.key, v)
                          }
                          style={styles.formInput}
                          keyboardType="numbers-and-punctuation"
                          autoCapitalize="none"
                        />
                        <View style={styles.inputEndIcon}>
                          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                              stroke="#64748b"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        </View>
                      </View>
                    ) : (
                      <TextInput
                        value={rawVal}
                        placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
                        placeholderTextColor="#94a3b8"
                        keyboardType={f.keyboardType || 'default'}
                        autoCapitalize={f.autoCapitalize || 'sentences'}
                        onChangeText={(v) =>
                          actions.updatePersonalInfoDraft(f.key, v)
                        }
                        style={styles.formInput}
                      />
                    )}
                  </View>
                );
              })}
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
                  <Text style={styles.rowValue}>{f.value || 'Not set'}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Sticky Edit Mode Action Footer */}
        {editing && (
          <View style={styles.footerBtns}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCancel}
              disabled={isSaving}
              style={[styles.cancelBtn, isSaving && { opacity: 0.6 }]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            >
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.saveBtnText}>Saving to Cloud...</Text>
                </View>
              ) : (
                <View style={styles.savingRow}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke="#ffffff"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </View>
              )}
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
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  subTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
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
    marginBottom: 16,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
  },
  editForm: {
    gap: 14,
  },
  formGroup: {
    gap: 5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  fieldHelper: {
    fontSize: 11,
    color: '#94a3b8',
  },
  dateInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  formInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  inputEndIcon: {
    position: 'absolute',
    right: 12,
  },
  displayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#041E42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.75,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
