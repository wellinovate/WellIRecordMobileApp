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
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { FormSelect } from '../components/FormSelect';
import { Avatar } from '../components/Avatar';
import { BLOOD_TYPES, GENDER_OPTIONS, GENOTYPES } from '../data/mockData';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Other'];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const YEARS = Array.from({ length: 105 }, (_, i) => String(2026 - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

function formatDobInput(text: string): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function FamilyAccessModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const [view, setView] = useState<'list' | 'add'>('list');

  // Add Form Local Draft State
  const [draftName, setDraftName] = useState('');
  const [draftRelationship, setDraftRelationship] = useState('Child');
  const [draftDob, setDraftDob] = useState('');
  const [draftGender, setDraftGender] = useState('');
  const [draftBloodType, setDraftBloodType] = useState('');
  const [draftGenotype, setDraftGenotype] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visual Date Picker Modal State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState('2018');
  const [pickerMonth, setPickerMonth] = useState('05');
  const [pickerDay, setPickerDay] = useState('12');
  const [activePickerTab, setActivePickerTab] = useState<'year' | 'month' | 'day'>('year');

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

  const handleOpenAdd = () => {
    hapticFeedback.light();
    setDraftName('');
    setDraftRelationship('Child');
    setDraftDob('');
    setDraftGender('');
    setDraftBloodType('');
    setDraftGenotype('');
    setView('add');
  };

  const handleClose = () => {
    setView('list');
    actions.closeFamilyAccess();
  };

  const handleSubmitAdd = async () => {
    if (isSubmitting) return;
    if (!draftName.trim()) {
      actions.showToast('Please enter a full name for the family member');
      return;
    }

    setIsSubmitting(true);
    hapticFeedback.light();
    try {
      const ok = await actions.addFamilyMember({
        fullName: draftName.trim(),
        relationship: draftRelationship,
        dateOfBirth: draftDob.trim(),
        gender: draftGender,
        bloodType: draftBloodType,
        genotype: draftGenotype,
      });

      if (ok) {
        setView('list');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={state.showFamilyAccess}
      animationType="slide"
      transparent={false}
      onRequestClose={view === 'add' ? () => setView('list') : handleClose}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title={view === 'add' ? 'Add Family Member' : 'Family & Caregiver Access'}
          onClose={handleClose}
          onBack={view === 'add' ? () => setView('list') : handleClose}
        />

        {view === 'list' ? (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={true}
            alwaysBounceVertical={true}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenAdd}
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
        ) : (
          /* Add Family Member Form View */
          <View style={{ flex: 1 }}>
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
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Nia Nwosu"
                placeholderTextColor="#94a3b8"
                style={styles.textInput}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Relationship *</Text>
              <View style={styles.relationshipRow}>
                {RELATIONSHIPS.map((r) => {
                  const selected = draftRelationship === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      activeOpacity={0.7}
                      onPress={() => {
                        hapticFeedback.selection();
                        setDraftRelationship(r);
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

              {/* Dual-Entry Date of Birth */}
              <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <View style={styles.dateInputWrapper}>
                <TextInput
                  value={draftDob}
                  placeholder="YYYY-MM-DD (e.g. 2018-05-12)"
                  placeholderTextColor="#94a3b8"
                  onChangeText={(v) => setDraftDob(formatDobInput(v))}
                  keyboardType="numeric"
                  maxLength={10}
                  style={styles.dateTextInput}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.light();
                    if (draftDob && draftDob.includes('-')) {
                      const parts = draftDob.split('-');
                      if (parts[0]) setPickerYear(parts[0]);
                      if (parts[1]) setPickerMonth(parts[1]);
                      if (parts[2]) setPickerDay(parts[2]);
                    }
                    setShowDatePicker(true);
                  }}
                  style={styles.calendarIconBtn}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#0284c7" strokeWidth={1.8} />
                    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0284c7" strokeWidth={1.8} />
                  </Svg>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.selectWrapper}>
                <FormSelect
                  value={draftGender}
                  onChange={setDraftGender}
                  options={GENDER_OPTIONS}
                  placeholder="Select gender"
                />
              </View>

              <Text style={styles.fieldLabel}>Blood Type</Text>
              <View style={styles.selectWrapper}>
                <FormSelect
                  value={draftBloodType}
                  onChange={setDraftBloodType}
                  options={BLOOD_TYPES}
                  placeholder="Select blood type"
                />
              </View>

              <Text style={styles.fieldLabel}>Genotype</Text>
              <View style={styles.selectWrapper}>
                <FormSelect
                  value={draftGenotype}
                  onChange={setDraftGenotype}
                  options={GENOTYPES}
                  placeholder="Select genotype"
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmitAdd}
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
          </View>
        )}

        {/* Reused Interactive Visual Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerCard}>
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.pickerHeaderTitle}>Select Date of Birth</Text>
                <Text style={styles.pickerHeaderPreview}>
                  {pickerYear}-{pickerMonth}-{pickerDay}
                </Text>
              </View>

              {/* Segmented Picker Tabs */}
              <View style={styles.pickerTabRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActivePickerTab('year')}
                  style={[styles.pickerTabBtn, activePickerTab === 'year' && styles.pickerTabBtnActive]}
                >
                  <Text style={[styles.pickerTabText, activePickerTab === 'year' && styles.pickerTabTextActive]}>
                    Year ({pickerYear})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActivePickerTab('month')}
                  style={[styles.pickerTabBtn, activePickerTab === 'month' && styles.pickerTabBtnActive]}
                >
                  <Text style={[styles.pickerTabText, activePickerTab === 'month' && styles.pickerTabTextActive]}>
                    Month ({MONTH_NAMES[parseInt(pickerMonth, 10) - 1] || pickerMonth})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActivePickerTab('day')}
                  style={[styles.pickerTabBtn, activePickerTab === 'day' && styles.pickerTabBtnActive]}
                >
                  <Text style={[styles.pickerTabText, activePickerTab === 'day' && styles.pickerTabTextActive]}>
                    Day ({pickerDay})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Options Grid */}
              <View style={styles.pickerOptionsContainer}>
                {activePickerTab === 'year' && (
                  <FlatList
                    data={YEARS}
                    keyExtractor={(item) => item}
                    numColumns={3}
                    contentContainerStyle={styles.gridContent}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.gridChip, pickerYear === item && styles.gridChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setPickerYear(item);
                          setActivePickerTab('month');
                        }}
                      >
                        <Text style={[styles.gridChipText, pickerYear === item && styles.gridChipTextActive]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {activePickerTab === 'month' && (
                  <FlatList
                    data={MONTHS}
                    keyExtractor={(item) => item}
                    numColumns={3}
                    contentContainerStyle={styles.gridContent}
                    renderItem={({ item, index }) => (
                      <TouchableOpacity
                        style={[styles.gridChip, pickerMonth === item && styles.gridChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setPickerMonth(item);
                          setActivePickerTab('day');
                        }}
                      >
                        <Text style={[styles.gridChipText, pickerMonth === item && styles.gridChipTextActive]}>
                          {MONTH_NAMES[index]} ({item})
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {activePickerTab === 'day' && (
                  <FlatList
                    data={DAYS}
                    keyExtractor={(item) => item}
                    numColumns={4}
                    contentContainerStyle={styles.gridContent}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.gridChip, pickerDay === item && styles.gridChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setPickerDay(item);
                        }}
                      >
                        <Text style={[styles.gridChipText, pickerDay === item && styles.gridChipTextActive]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>

              {/* Confirm / Cancel Buttons */}
              <View style={styles.pickerActionsRow}>
                <TouchableOpacity
                  style={styles.pickerCancelBtn}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerConfirmBtn}
                  onPress={() => {
                    hapticFeedback.success();
                    const chosen = `${pickerYear}-${pickerMonth}-${pickerDay}`;
                    setDraftDob(chosen);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.pickerConfirmText}>Confirm Date</Text>
                </TouchableOpacity>
              </View>
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
  introText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
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
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    marginBottom: 16,
    paddingRight: 8,
  },
  dateTextInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  calendarIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
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
  // Date Picker Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerHeaderPreview: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  pickerTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  pickerTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  pickerTabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pickerTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  pickerTabTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  pickerOptionsContainer: {
    height: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 6,
    marginBottom: 14,
  },
  gridContent: {
    paddingVertical: 4,
  },
  gridChip: {
    flex: 1,
    margin: 3,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  gridChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  gridChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pickerActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  pickerCancelText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
  },
  pickerConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#041E42',
  },
  pickerConfirmText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
});
