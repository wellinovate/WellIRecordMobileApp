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
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { ModalHeader } from '../components/ModalHeader';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const TIME_SLOTS = [
  'Morning (09:00 AM – 11:30 AM)',
  'Afternoon (01:00 PM – 03:30 PM)',
  'Evening (04:30 PM – 06:30 PM)',
];

const QUICK_DATES = [
  { label: 'Today', value: '2026-05-14' },
  { label: 'Tomorrow', value: '2026-05-15' },
  { label: 'Monday', value: '2026-05-18' },
  { label: 'Wednesday', value: '2026-05-20' },
];

export function BookAppointmentModal({ app }: { app: WelliApp }) {
  const { state, actions, facilities, family } = app;
  const [selectedMemberId, setSelectedMemberId] = useState<string>(state.activeFamilyId || 'me');
  const [visitReason, setVisitReason] = useState<string>('');

  if (!state.showBookAppointment) return null;

  const external = state.externalBookingFacility;
  const facility = external
    ? {
        id: external.placeId || state.bookingFacilityId || 'external',
        name: external.name,
        emoji: '🔬',
        leadName: 'Attending Specialist / Pathologist',
        leadTitle: 'Healthcare Facility',
        specialty: 'Diagnostic Center / Clinic',
        address: external.address,
      }
    : facilities.find((f) => f.id === state.bookingFacilityId);

  if (!facility) return null;

  const activePatient = family.find((f) => f.id === selectedMemberId) ?? family[0];
  const disabled = !state.bookingDate || !state.bookingTimeSlot;

  const handleConfirm = () => {
    hapticFeedback.success();
    actions.confirmBooking();
  };

  return (
    <Modal
      visible={state.showBookAppointment}
      animationType="slide"
      transparent={false}
      onRequestClose={actions.closeBookAppointment}
    >
      <SafeAreaView style={styles.container}>
        <ModalHeader
          title="Book Care Visit"
          onClose={actions.closeBookAppointment}
        />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Facility Summary Card */}
          <View style={styles.facilityHeaderCard}>
            <View style={styles.facilityEmojiBox}>
              <Text style={{ fontSize: 22 }}>{facility.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.facilityName}>{facility.name}</Text>
              <Text style={styles.leadText}>
                {facility.leadName} · {facility.leadTitle}
              </Text>
              <Text style={styles.specialtyText}>{facility.specialty} · {facility.address}</Text>
            </View>
          </View>

          {/* Patient / Family Member Selector */}
          <Text style={styles.sectionLabel}>BOOKING APPOINTMENT FOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
            {family.map((m) => {
              const isSelected = m.id === selectedMemberId;
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedMemberId(m.id);
                  }}
                  style={[styles.memberChip, isSelected && styles.memberChipActive]}
                >
                  <Text style={[styles.memberChipText, isSelected && styles.memberChipTextActive]}>
                    {m.id === 'me' ? 'Myself' : m.name.split(' ')[0]} {m.relationship ? `(${m.relationship})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* HMO Coverage Pre-Auth Notice */}
          <View style={styles.hmoPreAuthBanner}>
            <Text style={{ fontSize: 16 }}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.hmoTitle}>HMO Pre-Authorization Verified</Text>
              <Text style={styles.hmoSub}>
                {activePatient.insuranceProvider} · Policy ID: {activePatient.insuranceId} (80% Tariff Co-Pay Applies)
              </Text>
            </View>
          </View>

          {/* Date Picker */}
          <Text style={styles.sectionLabel}>SELECT DATE</Text>
          <View style={styles.quickDatesRow}>
            {QUICK_DATES.map((qd) => {
              const isSelected = state.bookingDate === qd.value;
              return (
                <TouchableOpacity
                  key={qd.value}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    actions.setBookingDate(qd.value);
                  }}
                  style={[styles.dateChip, isSelected && styles.dateChipActive]}
                >
                  <Text style={[styles.dateChipLabel, isSelected && styles.dateChipLabelActive]}>
                    {qd.label}
                  </Text>
                  <Text style={[styles.dateChipValue, isSelected && styles.dateChipValueActive]}>
                    {qd.value.split('-').slice(1).join('/')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={state.bookingDate}
            onChangeText={actions.setBookingDate}
            placeholder="Or enter custom date: YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            style={styles.customDateInput}
          />

          {/* Time Slot Selector */}
          <Text style={styles.sectionLabel}>SELECT TIME WINDOW</Text>
          <View style={styles.slotsList}>
            {TIME_SLOTS.map((slot) => {
              const selected = state.bookingTimeSlot === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  activeOpacity={0.7}
                  onPress={() => {
                    hapticFeedback.selection();
                    actions.setBookingTimeSlot(slot);
                  }}
                  style={[
                    styles.slotCard,
                    {
                      borderColor: selected ? '#041E42' : '#e2e8f0',
                      backgroundColor: selected ? '#f0f9ff' : '#ffffff',
                    },
                  ]}
                >
                  <Text style={[styles.slotText, selected && styles.slotTextActive]}>{slot}</Text>
                  {selected && (
                    <Svg width={18} height={18} viewBox="0 0 20 20">
                      <Circle cx="10" cy="10" r="9" fill="#041E42" />
                      <Path
                        d="M6 10l3 3 5-6"
                        stroke="#ffffff"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reason for Visit */}
          <Text style={styles.sectionLabel}>REASON FOR VISIT (OPTIONAL)</Text>
          <TextInput
            value={visitReason}
            onChangeText={setVisitReason}
            placeholder="e.g. Routine checkup, fever, medication refill, test review"
            placeholderTextColor="#94a3b8"
            style={styles.reasonInput}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={disabled}
            style={[
              styles.requestBtn,
              { backgroundColor: disabled ? '#cbd5e1' : '#041E42' },
            ]}
          >
            <Text
              style={[
                styles.requestBtnText,
                { color: disabled ? '#64748b' : '#ffffff' },
              ]}
            >
              Confirm Appointment Request ›
            </Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  facilityHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  facilityEmojiBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  leadText: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2,
  },
  specialtyText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  memberScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  memberChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  memberChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  memberChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  memberChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  hmoPreAuthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  hmoTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534',
  },
  hmoSub: {
    fontSize: 11.5,
    color: '#15803d',
    marginTop: 1,
  },
  quickDatesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dateChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dateChipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  dateChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dateChipLabelActive: {
    color: '#0284c7',
  },
  dateChipValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  dateChipValueActive: {
    color: '#0284c7',
  },
  customDateInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 20,
  },
  slotsList: {
    gap: 8,
    marginBottom: 20,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  slotTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  reasonInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  requestBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  requestBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
