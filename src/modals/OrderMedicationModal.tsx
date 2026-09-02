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
import { ModalHeader } from '../components/ModalHeader';
import { hapticFeedback } from '../utils/haptics';
import { orderService } from '../services/orderService';
import type { WelliApp } from '../state/useWelliApp';

const ADDRESS_PRESETS: { label: string; type: 'home' | 'office' | 'pharmacy_pickup'; address: string }[] = [
  { label: 'Home', type: 'home', address: '' },
  { label: 'Office', type: 'office', address: '' },
  { label: 'Pharmacy Pickup', type: 'pharmacy_pickup', address: '' },
];

export function OrderMedicationModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedPresetLabel, setSelectedPresetLabel] = useState('Home');
  const [customAddress, setCustomAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!state.showOrderMedication) return null;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const selectedPreset = ADDRESS_PRESETS.find((p) => p.label === selectedPresetLabel);
  const resolvedAddress = customAddress.trim() || activeMember?.address || '';
  const canSubmit = medicationName.trim().length > 0 && resolvedAddress.trim().length > 0;

  const handleClose = () => {
    setMedicationName('');
    setDosage('');
    setQuantity('1');
    setSelectedPresetLabel('Home');
    setCustomAddress('');
    setNotes('');
    actions.closeOrderMedication();
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      actions.showToast('Enter the medication name and a delivery address');
      return;
    }
    hapticFeedback.success();
    setIsSubmitting(true);
    try {
      await orderService.createOrder({
        familyMemberId: activeMember?.id !== 'me' ? activeMember?.id : undefined,
        medicationName: medicationName.trim(),
        dosage: dosage.trim(),
        quantity: Number(quantity) || 1,
        deliveryAddress: resolvedAddress,
        deliveryType: selectedPreset?.type || 'custom',
        notes: notes.trim(),
      });
      actions.showToast('Order submitted — a licensed pharmacist will review it shortly');
      handleClose();
    } catch (err: any) {
      actions.showToast(err?.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={state.showOrderMedication} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <ModalHeader title="Order New Medication" onClose={handleClose} />

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
          <View style={styles.reviewBanner}>
            <Text style={{ fontSize: 16 }}>🩺</Text>
            <Text style={styles.reviewBannerText}>
              Orders are reviewed by a licensed pharmacist before dispatch. You'll be notified once it's approved.
            </Text>
          </View>

          <Text style={styles.sectionHeading}>MEDICATION</Text>
          <TextInput
            value={medicationName}
            onChangeText={setMedicationName}
            placeholder="e.g. Amoxicillin 500mg"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TextInput
            value={dosage}
            onChangeText={setDosage}
            placeholder="Dosage / strength (e.g. 500mg, twice daily)"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Quantity"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.sectionHeading}>DELIVER TO</Text>
          <View style={styles.addressPresetsList}>
            {ADDRESS_PRESETS.map((preset) => {
              const isSelected = selectedPresetLabel === preset.label;
              return (
                <TouchableOpacity
                  key={preset.label}
                  activeOpacity={0.75}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedPresetLabel(preset.label);
                  }}
                  style={[styles.addressCard, isSelected && styles.addressCardActive]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.addressLabel, isSelected && styles.addressLabelActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={customAddress}
            onChangeText={setCustomAddress}
            placeholder={activeMember?.address ? `Or enter a different address (default: ${activeMember.address})` : 'Enter delivery address'}
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.sectionHeading}>SPECIAL INSTRUCTIONS (OPTIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Leave with security gate, call on arrival"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </ScrollView>

        <View style={styles.footerBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            style={[styles.confirmBtn, (!canSubmit || isSubmitting) && styles.confirmBtnDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Submit Order for Review ›</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollArea: { flex: 1 },
  scrollInner: { padding: 18, paddingBottom: 36 },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 18,
  },
  reviewBannerText: { flex: 1, fontSize: 12, color: '#075985', lineHeight: 17 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 10,
  },
  addressPresetsList: { gap: 8, marginBottom: 8 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  addressCardActive: { borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: { borderColor: '#0284c7' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0284c7' },
  addressLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  addressLabelActive: { color: '#0284c7' },
  footerBar: { padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  confirmBtn: { backgroundColor: '#041E42', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#cbd5e1' },
  confirmBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
