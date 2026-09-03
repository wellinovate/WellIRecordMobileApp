import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import {
  FACILITY_SECTIONS,
  FACILITY_TYPE_FILTERS,
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
  const theme = useTheme();
  const [showCredentials, setShowCredentials] = useState(false);

  // Parse gradient colors or fallback based on facility type
  const gradColors: [string, string] =
    facility.type === 'Hospital'
      ? ['#1e3a8a', '#1d4ed8']
      : facility.type === 'Pharmacy'
      ? ['#047857', '#059669']
      : facility.type === 'Laboratory'
      ? ['#6b21a8', '#7c3aed']
      : ['#0f766e', '#0d9488'];

  const isVerified = Boolean(facility.verified || facility.isVerified);

  return (
    <View style={[styles.richCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Card Header: Strictly 2 badges — Status and Verified */}
      <LinearGradient
        colors={gradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.richCardHeader}
      >
        <View style={styles.headerBadgeRow}>
          {/* Badge 1: Accepting Patients Status */}
          <View
            style={[
              styles.statusPill,
              facility.acceptingPatients ? styles.statusPillOpen : styles.statusPillClosed,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: facility.acceptingPatients ? '#ffffff' : '#fca5a5' },
              ]}
            />
            <Text style={styles.statusPillText}>
              {facility.acceptingPatients ? 'Accepting Patients' : 'Capacity Full'}
            </Text>
          </View>

          {/* Badge 2: Verified Partner */}
          {isVerified && (
            <View style={styles.verifiedTag}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"
                  stroke="#5eead4"
                  strokeWidth={2}
                />
                <Path
                  d="M9 12l2 2 4-4"
                  stroke="#5eead4"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.verifiedTagText}>Verified</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Card Body: Provider & Doctor breathing room */}
      <View style={[styles.richCardBody, { backgroundColor: theme.surface }]}>
        {/* Facility Name */}
        <Text style={[styles.facilityName, { color: theme.text }]}>
          {facility.name}
        </Text>

        {/* Doctor & Lead info with clear hierarchy */}
        <View style={styles.doctorRow}>
          <Text style={[styles.doctorName, { color: theme.text }]}>
            👨‍⚕️ {facility.leadName}
          </Text>
          <Text style={[styles.doctorSub, { color: theme.muted }]}>
            {facility.leadTitle} · {facility.specialty}
          </Text>
        </View>

        {/* Facility Type & Address */}
        <View style={[styles.addressBox, { backgroundColor: theme.surface2 }]}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
            <Path
              d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"
              stroke="#059669"
              strokeWidth={1.8}
            />
            <Circle cx={12} cy={10} r={2.5} stroke="#059669" strokeWidth={1.8} />
          </Svg>
          <Text style={[styles.addressText, { color: theme.muted }]} numberOfLines={2}>
            {facility.emoji} {facility.typeLabel || facility.type} · {facility.address}
          </Text>
        </View>

        {/* Secondary Details: Available on Tap */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowCredentials(!showCredentials)}
          style={styles.detailsToggleBtn}
        >
          <Text style={[styles.detailsToggleText, { color: '#0ea5e9' }]}>
            {showCredentials ? '▲ Hide credentials & HMOs' : '▼ View accreditation & HMO coverage'}
          </Text>
        </TouchableOpacity>

        {showCredentials && (
          <View style={[styles.drawerContent, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
            {facility.accredited && (
              <View style={styles.drawerItem}>
                <Text style={{ fontSize: 13 }}>🎖️</Text>
                <Text style={[styles.drawerItemText, { color: theme.text }]}>
                  Accredited Healthcare Facility (NHIA & HEFAMAA Compliant)
                </Text>
              </View>
            )}
            {facility.acceptedHmos && facility.acceptedHmos.length > 0 && (
              <View style={styles.drawerItem}>
                <Text style={{ fontSize: 13 }}>🛡️</Text>
                <Text style={[styles.drawerItemText, { color: theme.text }]}>
                  Accepted HMOs: {facility.acceptedHmos.join(', ')}
                </Text>
              </View>
            )}
            {facility.instantBooking && (
              <View style={styles.drawerItem}>
                <Text style={{ fontSize: 13 }}>⚡</Text>
                <Text style={[styles.drawerItemText, { color: theme.text }]}>
                  Instant Online Booking Supported
                </Text>
              </View>
            )}
            {Boolean(facility.consultationFeeNaira) && (
              <View style={styles.drawerItem}>
                <Text style={{ fontSize: 13 }}>💳</Text>
                <Text style={[styles.drawerItemText, { color: theme.text }]}>
                  Standard Consultation: ₦{facility.consultationFeeNaira?.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Divider & Action Buttons */}
        <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

        <View style={styles.cardActionsRow}>
          {facility.acceptingPatients && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onBook}
              style={styles.bookAppointmentBtn}
            >
              <Text style={styles.bookAppointmentText}>📅 Book Visit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onShareVault}
            style={[styles.shareOrgBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.shareOrgBtnText, { color: theme.text }]}>
              Share Vault ›
            </Text>
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

      {/* Filter Category Tabs — single unified row with edge bleed so pills never cut off */}
      <View style={styles.filterSectionWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContentContainer}
        >
          {FACILITY_TYPE_FILTERS.map((f) => {
            const isActive = state.careFacilityType === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                activeOpacity={0.7}
                onPress={() => actions.setCareFacilityType(f.value)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? '#041E42' : theme.surface,
                    borderColor: isActive ? '#041E42' : theme.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive ? '#ffffff' : theme.text,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Inline Interactive Map Launcher (shown when Pharmacies or Diagnostic Centers tab is selected) */}
      {state.careFacilityType === 'Pharmacy' && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={actions.openPharmacyDirectory}
          style={[styles.directoryInlineBar, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.directoryInlineLeft}>
            <Text style={{ fontSize: 16 }}>🗺️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.directoryInlineTitle, { color: theme.text }]}>Abuja Pharmacy Locator Map</Text>
              <Text style={[styles.directoryInlineSub, { color: theme.muted }]} numberOfLines={1}>
                View licensed pharmacies on interactive Apple Maps
              </Text>
            </View>
          </View>
          <View style={[styles.directoryInlineBtn, { backgroundColor: '#0EA5E9' }]}>
            <Text style={styles.directoryInlineBtnText}>Open Map ›</Text>
          </View>
        </TouchableOpacity>
      )}

      {state.careFacilityType === 'Laboratory' && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={actions.openLabDirectory}
          style={[styles.directoryInlineBar, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.directoryInlineLeft}>
            <Text style={{ fontSize: 16 }}>🔬</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.directoryInlineTitle, { color: theme.text }]}>Abuja Diagnostic Centers Map</Text>
              <Text style={[styles.directoryInlineSub, { color: theme.muted }]} numberOfLines={1}>
                View accredited labs and imaging centers on interactive Apple Maps
              </Text>
            </View>
          </View>
          <View style={[styles.directoryInlineBtn, { backgroundColor: '#059669' }]}>
            <Text style={styles.directoryInlineBtnText}>Open Map ›</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Active E-Prescriptions & Fast Refills Widget (if active) */}
      {prescriptions && prescriptions.length > 0 && (
        <View style={styles.prescriptionsWidget}>
          <View style={styles.rxWidgetHeader}>
            <Text style={{ fontSize: 16 }}>💊</Text>
            <Text style={[styles.rxWidgetTitle, { color: theme.text }]}>Active E-Prescriptions & Refills</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={actions.openPharmacyDirectory}
                style={[styles.rxLocatorBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}
              >
                <Text style={[styles.rxLocatorBtnText, { color: '#1d4ed8' }]}>📍 Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={actions.openOrderMedication}
                style={styles.orderNewBtn}
              >
                <Text style={styles.orderNewBtnText}>+ Order New</Text>
              </TouchableOpacity>
            </View>
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

      {/* Result Count Header */}
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
          {/* Section Header with count directly anchored */}
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 16 }}>{section.emoji}</Text>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              {section.label}
            </Text>
            <Text style={[styles.sectionCountText, { color: theme.mutedLight }]}>
              ({section.items.length})
            </Text>
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
    marginBottom: 12,
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
  filterSectionWrapper: {
    marginBottom: 12,
  },
  filterScrollView: {
    marginHorizontal: -20,
  },
  filterContentContainer: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabChipText: {
    fontSize: 13,
  },
  directoryInlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  directoryInlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  directoryInlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  directoryInlineSub: {
    fontSize: 11,
  },
  directoryInlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  directoryInlineBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  prescriptionsWidget: {
    marginBottom: 16,
  },
  rxWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  rxWidgetTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rxLocatorBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  rxLocatorBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderNewBtn: {
    backgroundColor: '#041E42',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  orderNewBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  rxScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  rxMiniCard: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginRight: 10,
  },
  rxCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rxMiniName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  rxCountPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rxCountPillEmpty: {
    backgroundColor: '#f1f5f9',
  },
  rxCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  rxCountPillTextEmpty: {
    color: '#94a3b8',
  },
  rxMiniDosage: {
    fontSize: 11,
    marginBottom: 2,
  },
  rxMiniHmo: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 8,
  },
  miniRefillBtn: {
    backgroundColor: '#059669',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  miniRefillBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  miniRefillBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  resultCount: {
    fontSize: 12,
    marginBottom: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13.5,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  facilityList: {
    gap: 14,
  },
  richCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  richCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusPillOpen: {
    backgroundColor: 'rgba(16,185,129,0.9)',
  },
  statusPillClosed: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedTag: {
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
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
    padding: 16,
  },
  facilityName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 8,
  },
  doctorRow: {
    marginBottom: 10,
  },
  doctorName: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  doctorSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  addressBox: {
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  addressText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  detailsToggleBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 10,
  },
  detailsToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  drawerContent: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerItemText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },
  cardDivider: {
    height: 1,
    marginBottom: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookAppointmentBtn: {
    backgroundColor: '#041E42',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookAppointmentText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  shareOrgBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  shareOrgBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
