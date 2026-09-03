import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import {
  FACILITY_SECTIONS,
  FACILITY_TYPE_FILTERS,
  SPECIALTY_FILTERS,
} from '../data/mockData';
import type { CareFacility } from '../data/types';
import type { WelliApp } from '../state/useWelliApp';

function FacilityCard({
  facility,
  onBook,
  onShareVault,
}: {
  facility: CareFacility;
  onBook: () => void;
  onShareVault: () => void;
}) {
  const isRich = facility.type !== 'Private Practice';

  if (!isRich) {
    return (
      <View style={styles.simpleCard}>
        <View style={styles.simpleEmojiBox}>
          <Text style={{ fontSize: 18 }}>{facility.emoji}</Text>
        </View>
        <View style={styles.simpleInfo}>
          <Text style={styles.simpleName}>{facility.name}</Text>
          <Text style={styles.simpleSub}>
            {facility.leadTitle} · {facility.specialty}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onShareVault}
            style={styles.shareSmallBtn}
            accessibilityLabel={`Share vault with ${facility.name}`}
          >
            <Text style={styles.shareSmallText}>Share</Text>
          </TouchableOpacity>
          {facility.acceptingPatients ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onBook}
              style={styles.bookSmallBtn}
            >
              <Text style={styles.bookSmallText}>Book</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.notAcceptingText}>Not accepting</Text>
          )}
        </View>
      </View>
    );
  }

  // Parse gradient colors or fallback
  const gradColors: [string, string] =
    facility.type === 'Hospital'
      ? ['#1e3a8a', '#1d4ed8']
      : facility.type === 'Pharmacy'
      ? ['#047857', '#059669']
      : ['#6b21a8', '#7c3aed'];

  return (
    <View style={styles.richCard}>
      <LinearGradient
        colors={gradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.richCardHeader}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.facilityPill}>
            <Text style={styles.facilityPillText}>
              {facility.emoji} {facility.typeLabel}
            </Text>
          </View>
          {facility.acceptingPatients && (
            <View style={styles.acceptingPill}>
              <View style={styles.whiteDot} />
              <Text style={styles.acceptingPillText}>Accepting Patients</Text>
            </View>
          )}
        </View>

        {(facility.accredited || facility.verified) && (
          <View style={styles.badgeRow}>
            {facility.accredited && (
              <View style={styles.accreditedBox}>
                <View style={styles.accreditedBadge}>
                  <Text style={styles.accreditedW}>W</Text>
                </View>
                <Text style={styles.accreditedText}>Accredited Facility</Text>
              </View>
            )}
            {facility.verified && (
              <View style={styles.verifiedTag}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                    stroke="#5eead4"
                    strokeWidth={2}
                  />
                </Svg>
                <Text style={styles.verifiedTagText}>Verified</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      <View style={styles.richCardBody}>
        <Text style={styles.facilityName}>{facility.name}</Text>
        <Text style={styles.leadInfo}>
          {facility.leadName} · {facility.leadTitle}
        </Text>

        <View style={styles.addressBox}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
            <Path
              d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"
              stroke="#059669"
              strokeWidth={1.8}
            />
            <Circle cx={12} cy={10} r={2.5} stroke="#059669" strokeWidth={1.8} />
          </Svg>
          <Text style={styles.addressText}>{facility.address}</Text>
        </View>

        {facility.instantBooking && (
          <View style={styles.instantBookingTag}>
            <Text style={{ fontSize: 12 }}>⚡</Text>
            <Text style={styles.instantBookingText}>Instant Booking</Text>
          </View>
        )}

        <View style={styles.cardDivider} />

        <View style={styles.cardActionsRow}>
          {facility.acceptingPatients && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onBook}
              style={styles.bookAppointmentBtn}
            >
              <Svg width={15} height={15} viewBox="0 0 20 20" fill="none">
                <Rect x={3} y={4} width={14} height={13} rx={2} stroke="#ffffff" strokeWidth={1.6} />
                <Path d="M3 8h14M7 2v4M13 2v4" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
              <Text style={styles.bookAppointmentText}>Book Visit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onShareVault}
            style={styles.shareOrgBtn}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Circle cx={6} cy={12} r={2.6} stroke="#041E42" strokeWidth={2} />
              <Circle cx={17} cy={6} r={2.6} stroke="#041E42" strokeWidth={2} />
              <Circle cx={17} cy={18} r={2.6} stroke="#041E42" strokeWidth={2} />
              <Path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" stroke="#041E42" strokeWidth={1.8} />
            </Svg>
            <Text style={styles.shareOrgBtnText}>Share Vault with Hospital ›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function CareScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, facilities, prescriptions } = app;

  const cq = state.careQuery.trim().toLowerCase();
  const filtered = facilities
    .filter(
      (f) => state.careFacilityType === 'All' || f.type === state.careFacilityType
    )
    .filter(
      (f) =>
        state.careSpecialty === 'All Specialties' ||
        f.specialty === state.careSpecialty
    )
    .filter(
      (f) =>
        !cq ||
        f.name.toLowerCase().includes(cq) ||
        f.specialty.toLowerCase().includes(cq) ||
        f.leadName.toLowerCase().includes(cq)
    );

  const sectionsWithResults = FACILITY_SECTIONS.map((section) => ({
    ...section,
    items: filtered.filter((f) => f.type === section.type),
  })).filter((section) => section.items.length > 0);

  const categoryCount = new Set(filtered.map((f) => f.type)).size;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Title Header */}
      <View style={styles.headerRow}>
        {state.tabHistory.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={actions.goBackTab}
            style={[
              styles.backBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Go back to previous page"
          >
            <Svg width={14} height={14} viewBox="0 0 20 20">
              <Path
                d="M12 4l-6 6 6 6"
                stroke={theme.text}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: theme.text }]}>Find Care</Text>
      </View>

      {/* Telehealth Banner removed — no real appointment scheduling backend
          exists yet. Previously showed a hardcoded fake appointment
          ("Dr. Sarah Chen · Today, 3:00 PM") to every user unconditionally. */}

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Svg width={16} height={16} viewBox="0 0 20 20" style={styles.searchIcon}>
          <Circle cx="8.5" cy="8.5" r="6" stroke={theme.mutedLight} strokeWidth={1.8} fill="none" />
          <Path d="M13 13l4 4" stroke={theme.mutedLight} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <TextInput
          value={state.careQuery}
          onChangeText={actions.setCareQuery}
          placeholder="Search hospital, clinic, lab, pharmacy, or doctor..."
          placeholderTextColor={theme.mutedLight}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />
      </View>

      {/* Filter Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ paddingRight: 10 }}
      >
        {FACILITY_TYPE_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            active={state.careFacilityType === f.value}
            onClick={() => actions.setCareFacilityType(f.value)}
          />
        ))}
      </ScrollView>

      {/* Specialty Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ paddingRight: 10 }}
      >
        {SPECIALTY_FILTERS.map((s) => (
          <Chip
            key={s}
            label={s}
            active={state.careSpecialty === s}
            onClick={() => actions.setCareSpecialty(s)}
          />
        ))}
      </ScrollView>

      {/* Active E-Prescriptions & Fast Refills Widget */}
      {prescriptions && prescriptions.length > 0 && (
        <View style={styles.prescriptionsWidget}>
          <View style={styles.rxWidgetHeader}>
            <Text style={{ fontSize: 16 }}>💊</Text>
            <Text style={[styles.rxWidgetTitle, { color: theme.text }]}>Active E-Prescriptions & Refills</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={actions.openOrderMedication}
              style={styles.orderNewBtn}
            >
              <Text style={styles.orderNewBtnText}>+ Order New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rxScroll} contentContainerStyle={{ paddingRight: 10 }}>
            {prescriptions.map((rx) => {
              const noRefills = rx.refillsRemaining <= 0;
              return (
                <View key={rx.id} style={[styles.rxMiniCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.rxCardTop}>
                    <Text style={[styles.rxMiniName, { color: theme.text }]} numberOfLines={1}>
                      {rx.medicationName}
                    </Text>
                    <View style={[styles.rxCountPill, noRefills && styles.rxCountPillEmpty]}>
                      <Text style={[styles.rxCountPillText, noRefills && styles.rxCountPillTextEmpty]}>
                        {rx.refillsRemaining} Refills
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rxMiniDosage, { color: theme.muted }]}>{rx.dosage}</Text>
                  <Text style={styles.rxMiniHmo}>₦{rx.patientCoPayNaira.toLocaleString()} Co-Pay · {rx.hmoProvider?.split(' ')[0] || 'HMO'}</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => actions.openRefillModal(rx.id)}
                    disabled={noRefills}
                    style={[styles.miniRefillBtn, noRefills && styles.miniRefillBtnDisabled]}
                  >
                    <Text style={styles.miniRefillBtnText}>
                      {noRefills ? 'Completed' : '1-Tap Refill ›'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Result Count */}
      <Text style={[styles.resultCount, { color: theme.mutedLight }]}>
        Showing {filtered.length} {filtered.length === 1 ? 'provider' : 'providers'} across{' '}
        {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
      </Text>

      {/* Empty State */}
      {filtered.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.mutedLight }]}>
            No providers match your search.
          </Text>
        </View>
      )}

      {/* Categorized Facility Sections */}
      {sectionsWithResults.map((section) => (
        <View key={section.type} style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 16 }}>{section.emoji}</Text>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              {section.label}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{section.items.length}</Text>
            </View>
          </View>

          <View style={styles.facilityList}>
            {section.items.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                onBook={() => actions.openBookAppointment(facility.id)}
                onShareVault={() => actions.shareWithFacility(facility.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  searchInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 38,
    paddingRight: 14,
    fontSize: 14,
  },
  chipScroll: {
    marginBottom: 10,
  },
  resultCount: {
    fontSize: 12,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13.5,
  },
  sectionBlock: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  facilityList: {
    gap: 12,
  },
  simpleCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simpleEmojiBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleInfo: {
    flex: 1,
  },
  simpleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  simpleSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  bookSmallBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  bookSmallText: {
    color: '#041E42',
    fontSize: 12,
    fontWeight: '700',
  },
  shareSmallBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  shareSmallText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  notAcceptingText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  richCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  richCardHeader: {
    padding: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  facilityPill: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  facilityPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  acceptingPill: {
    backgroundColor: 'rgba(16,185,129,0.9)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  whiteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  acceptingPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  accreditedBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accreditedBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accreditedW: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 11,
  },
  accreditedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  verifiedTag: {
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verifiedTagText: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '700',
  },
  richCardBody: {
    backgroundColor: '#ffffff',
    padding: 16,
  },
  facilityName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  leadInfo: {
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 12,
  },
  addressBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 12.5,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  instantBookingTag: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  instantBookingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400e',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardActionsRow: {
    gap: 8,
  },
  bookAppointmentBtn: {
    backgroundColor: '#041E42',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookAppointmentText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  shareOrgBtn: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareOrgBtnText: {
    color: '#166534',
    fontSize: 13.5,
    fontWeight: '700',
  },
  notAcceptingLongText: {
    textAlign: 'center',
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '600',
    paddingVertical: 6,
  },
  prescriptionsWidget: {
    marginBottom: 20,
  },
  rxWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  rxWidgetTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  orderNewBtn: {
    marginLeft: 'auto',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  orderNewBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  rxScroll: {
    flexDirection: 'row',
  },
  rxMiniCard: {
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginRight: 10,
    justifyContent: 'space-between',
  },
  rxCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rxMiniName: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    marginRight: 6,
  },
  rxCountPill: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  rxCountPillEmpty: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  rxCountPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  rxCountPillTextEmpty: {
    color: '#dc2626',
  },
  rxMiniDosage: {
    fontSize: 11,
    marginBottom: 4,
  },
  rxMiniHmo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 10,
  },
  miniRefillBtn: {
    backgroundColor: '#041E42',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  miniRefillBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  miniRefillBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
