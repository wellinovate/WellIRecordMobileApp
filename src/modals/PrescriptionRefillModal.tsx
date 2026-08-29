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
import { formatNaira } from '../utils/currency';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const ADDRESS_PRESETS = [
  { label: 'Home', address: 'Block 12, Admiralty Way, Lekki Phase 1, Lagos' },
  { label: 'Office', address: 'Plot 8, Adeola Odeku Street, Victoria Island, Lagos' },
  { label: 'Pharmacy Pickup', address: 'MediTrust Pharmacy, Admiralty Mall, Lekki' },
];

export function PrescriptionRefillModal({ app }: { app: WelliApp }) {
  const { state, actions, prescriptions, family } = app;
  const [selectedAddress, setSelectedAddress] = useState(ADDRESS_PRESETS[0].address);
  const [customNotes, setCustomNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!state.showRefillModal) return null;

  const rx = prescriptions.find((p) => p.id === state.showRefillModal);
  if (!rx) return null;

  const patient = family.find((f) => f.id === rx.ownerId) || family[0];
  const noRefillsLeft = rx.refillsRemaining <= 0;

  const handleConfirmRefill = () => {
    hapticFeedback.success();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      actions.requestRefill({
        prescriptionId: rx.id,
        deliveryAddress: selectedAddress,
        notes: customNotes,
      });
    }, 1000);
  };

  return (
    <Modal
      visible={!!state.showRefillModal}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeRefillModal}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Medication Refill & Dispatch"
          onClose={actions.closeRefillModal}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Medication Header Card */}
          <View style={styles.rxHeaderCard}>
            <View style={styles.rxIconCircle}>
              <Text style={{ fontSize: 24 }}>💊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rxMedName}>{rx.medicationName}</Text>
              <Text style={styles.rxDosage}>{rx.dosage}</Text>
              <Text style={styles.rxPrescriber}>{rx.prescriber}</Text>
            </View>
            <View style={[styles.refillCountBadge, noRefillsLeft && styles.refillCountBadgeEmpty]}>
              <Text style={[styles.refillCountText, noRefillsLeft && styles.refillCountTextEmpty]}>
                {rx.refillsRemaining} / {rx.refillsTotal} Refills Left
              </Text>
            </View>
          </View>

          {/* HMO Insurance Coverage Banner */}
          <View style={styles.hmoCoverageBanner}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.hmoTitle}>HMO Coverage Pre-Authorized</Text>
              <Text style={styles.hmoSub}>
                {rx.hmoProvider || `${patient.insuranceProvider} (80% Tariff Co-Pay)`} · Direct Settlement
              </Text>
            </View>
          </View>

          {/* Price Breakdown in Naira */}
          <Text style={styles.sectionHeading}>PRICE & HMO CO-PAY BREAKDOWN</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Pharmacy Retail Cost (30-Day Supply)</Text>
              <Text style={styles.priceVal}>{formatNaira(rx.totalPriceNaira)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>HMO 80% Insurer Coverage</Text>
              <Text style={styles.priceValGreen}>-{formatNaira(rx.hmoCoveredNaira)}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalPayLabel}>Patient 20% Co-Pay</Text>
              <Text style={styles.totalPayVal}>{formatNaira(rx.patientCoPayNaira)}</Text>
            </View>
          </View>

          {/* Delivery Address Selection */}
          <Text style={styles.sectionHeading}>DISPATCH / DELIVERY ADDRESS</Text>
          <View style={styles.addressPresetsList}>
            {ADDRESS_PRESETS.map((preset) => {
              const isSelected = selectedAddress === preset.address;
              return (
                <TouchableOpacity
                  key={preset.label}
                  activeOpacity={0.75}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedAddress(preset.address);
                  }}
                  style={[styles.addressCard, isSelected && styles.addressCardActive]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addressLabel, isSelected && styles.addressLabelActive]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.addressText}>{preset.address}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={selectedAddress}
            onChangeText={setSelectedAddress}
            placeholder="Or enter custom Lagos delivery address"
            placeholderTextColor="#94a3b8"
            style={styles.customAddressInput}
          />

          {/* Dispatch & Pharmacy Partner Info */}
          <Text style={styles.sectionHeading}>FULFILLING PHARMACY & DISPATCH TIMELINE</Text>
          <View style={styles.dispatchTimelineCard}>
            <View style={styles.pharmacyRow}>
              <Text style={{ fontSize: 16 }}>🏥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pharmacyName}>{rx.pharmacyProvider}</Text>
                <Text style={styles.pharmacySub}>Licensed Pharmacist Verification on Duty</Text>
              </View>
            </View>

            <View style={styles.timelineList}>
              <View style={styles.timelineStep}>
                <View style={[styles.stepCircle, styles.stepCircleDone]}>
                  <Text style={styles.stepCircleIcon}>✓</Text>
                </View>
                <View style={styles.stepTextCol}>
                  <Text style={styles.stepName}>HMO Pre-Auth Validated</Text>
                  <Text style={styles.stepTime}>Instant Verification</Text>
                </View>
              </View>

              <View style={styles.timelineStep}>
                <View style={[styles.stepCircle, styles.stepCircleActive]}>
                  <Text style={styles.stepCircleIcon}>2</Text>
                </View>
                <View style={styles.stepTextCol}>
                  <Text style={styles.stepName}>Pharmacist Dispensing & Quality Check</Text>
                  <Text style={styles.stepTime}>Within 2 hours</Text>
                </View>
              </View>

              <View style={styles.timelineStep}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleIcon}>3</Text>
                </View>
                <View style={styles.stepTextCol}>
                  <Text style={styles.stepName}>Doorstep Delivery via Express Rider</Text>
                  <Text style={styles.stepTime}>Estimated: {rx.eta}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Delivery Note */}
          <Text style={styles.sectionHeading}>SPECIAL INSTRUCTIONS (OPTIONAL)</Text>
          <TextInput
            value={customNotes}
            onChangeText={setCustomNotes}
            placeholder="e.g. Leave package with estate security gate, call on arrival"
            placeholderTextColor="#94a3b8"
            style={styles.notesInput}
          />
        </ScrollView>

        {/* Footer Confirm Action */}
        <View style={styles.footerBar}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleConfirmRefill}
            disabled={isSubmitting || noRefillsLeft}
            style={[
              styles.confirmBtn,
              noRefillsLeft && styles.confirmBtnDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>
                {noRefillsLeft
                  ? 'No Refills Remaining · Consult Doctor'
                  : `Confirm Refill & Dispatch (${formatNaira(rx.patientCoPayNaira)}) ›`}
              </Text>
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
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
  },
  scrollInner: {
    padding: 18,
    paddingBottom: 36,
  },
  rxHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rxIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxMedName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  rxDosage: {
    fontSize: 12.5,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  rxPrescriber: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  refillCountBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  refillCountBadgeEmpty: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  refillCountText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  refillCountTextEmpty: {
    color: '#dc2626',
  },
  hmoCoverageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 18,
  },
  hmoTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534',
  },
  hmoSub: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  priceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 12.5,
    color: '#475569',
  },
  priceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  priceValGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  totalPayLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalPayVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#041E42',
  },
  addressPresetsList: {
    gap: 8,
    marginBottom: 8,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  addressCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleActive: {
    borderColor: '#0284c7',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
  },
  addressLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  addressLabelActive: {
    color: '#0284c7',
  },
  addressText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  customAddressInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 18,
  },
  dispatchTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  pharmacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  pharmacyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  pharmacySub: {
    fontSize: 11,
    color: '#64748b',
  },
  timelineList: {
    gap: 12,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#10b981',
  },
  stepCircleActive: {
    backgroundColor: '#0284c7',
  },
  stepCircleIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepTextCol: {
    flex: 1,
  },
  stepName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  stepTime: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  notesInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  footerBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
