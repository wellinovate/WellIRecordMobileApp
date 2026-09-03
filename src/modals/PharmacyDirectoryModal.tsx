import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { pharmacyService, type PharmacyDirectoryItem } from '../services/pharmacyService';
import { hapticFeedback } from '../utils/haptics';
import type { WelliApp } from '../state/useWelliApp';

const PRIMARY_COLOR = '#0EA5E9';

// Abuja center coordinates as the default map region
const ABUJA_REGION = {
  latitude: 9.0765,
  longitude: 7.4586,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const DISTRICT_COORDINATES: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  All: ABUJA_REGION,
  Wuse: { latitude: 9.078, longitude: 7.48, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Utako: { latitude: 9.065, longitude: 7.442, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Maitama: { latitude: 9.088, longitude: 7.494, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Asokoro: { latitude: 9.044, longitude: 7.526, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Jabi: { latitude: 9.072, longitude: 7.423, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Jahi: { latitude: 9.092, longitude: 7.439, latitudeDelta: 0.04, longitudeDelta: 0.04 },
  Wuye: { latitude: 9.053, longitude: 7.453, latitudeDelta: 0.04, longitudeDelta: 0.04 },
};

const DISTRICTS = ['All', 'Wuse', 'Utako', 'Maitama', 'Asokoro', 'Jabi', 'Jahi', 'Wuye'];

export function PharmacyDirectoryModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const mapRef = useRef<MapView>(null);

  const [pharmacies, setPharmacies] = useState<PharmacyDirectoryItem[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyDirectoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const isVisible = Boolean(state.showPharmacyDirectory);

  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;

    pharmacyService
      .fetchPharmacies()
      .then((res) => {
        if (isMounted) {
          setPharmacies(res.pharmacies);
          setUsedFallback(res.usedFallback);
          setSelectedPharmacy((prev) => prev ?? (res.pharmacies.length > 0 ? res.pharmacies[0] : null));
        }
      })
      .catch((err) => {
        console.error('[PharmacyDirectoryModal] load error:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isVisible]);

  const filteredPharmacies = useMemo(() => {
    if (selectedDistrict === 'All') return pharmacies;
    return pharmacies.filter(
      (p) => p.district.toLowerCase() === selectedDistrict.toLowerCase()
    );
  }, [pharmacies, selectedDistrict]);

  const handleSelectDistrict = (district: string) => {
    hapticFeedback.light();
    setSelectedDistrict(district);

    const region = DISTRICT_COORDINATES[district] || ABUJA_REGION;
    mapRef.current?.animateToRegion(region, 500);

    const matching = district === 'All'
      ? pharmacies
      : pharmacies.filter((p) => p.district.toLowerCase() === district.toLowerCase());

    if (matching.length > 0) {
      setSelectedPharmacy(matching[0]);
    } else {
      setSelectedPharmacy(null);
    }
  };

  const handleSelectPharmacy = (pharmacy: PharmacyDirectoryItem) => {
    hapticFeedback.light();
    setSelectedPharmacy(pharmacy);
    if (pharmacy.lat && pharmacy.lng) {
      mapRef.current?.animateToRegion(
        {
          latitude: pharmacy.lat,
          longitude: pharmacy.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
    }
  };

  const handleOpenDirections = (pharmacy: PharmacyDirectoryItem) => {
    hapticFeedback.selection();
    const query = encodeURIComponent(`${pharmacy.name}, ${pharmacy.address}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://maps.google.com/maps/search/?api=1&query=${query}`,
    });

    Linking.openURL(url).catch((err) => {
      console.error('[Open Directions Error]', err);
      actions.showToast('Unable to open map application');
    });
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={actions.closePharmacyDirectory}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader
          title="Abuja Pharmacy Locator"
          onClose={actions.closePharmacyDirectory}
        />

        {/* Informational banner: Locator only / distinct from partner facilities */}
        <View style={[styles.disclaimerBar, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <Text style={{ fontSize: 13 }}>📍</Text>
          <Text style={[styles.disclaimerText, { color: theme.muted }]}>
            Public directory locator. To share records or manage consent, use verified WelliRecord partner facilities.
          </Text>
        </View>

        {/* Fallback Notice Banner when Google Places API is offline or returns empty */}
        {usedFallback && (
          <View style={[styles.fallbackBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Text style={{ fontSize: 13 }}>⚠️</Text>
            <Text style={[styles.fallbackBannerText, { color: '#92400E' }]}>
              Showing verified offline directory — live search currently unavailable.
            </Text>
          </View>
        )}

        {/* District Filter Chips */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {DISTRICTS.map((district) => {
              const isActive = selectedDistrict === district;
              return (
                <TouchableOpacity
                  key={district}
                  activeOpacity={0.7}
                  onPress={() => handleSelectDistrict(district)}
                  style={[
                    styles.districtChip,
                    {
                      backgroundColor: isActive ? PRIMARY_COLOR : theme.surface,
                      borderColor: isActive ? PRIMARY_COLOR : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.districtChipText,
                      { color: isActive ? '#ffffff' : theme.text },
                    ]}
                  >
                    {district}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.comingSoonBadge}>
              <Text style={[styles.comingSoonText, { color: theme.mutedLight }]}>+ More areas coming soon</Text>
            </View>
          </ScrollView>
        </View>

        {/* View Mode Toggle: Map vs List */}
        <View style={styles.viewToggleRow}>
          <Text style={[styles.resultsCount, { color: theme.muted }]}>
            {filteredPharmacies.length} {filteredPharmacies.length === 1 ? 'pharmacy' : 'pharmacies'} found
          </Text>
          <View style={[styles.togglePill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.light();
                setViewMode('map');
              }}
              style={[
                styles.toggleOption,
                viewMode === 'map' && { backgroundColor: PRIMARY_COLOR },
              ]}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  { color: viewMode === 'map' ? '#ffffff' : theme.muted },
                ]}
              >
                🗺️ Map
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.light();
                setViewMode('list');
              }}
              style={[
                styles.toggleOption,
                viewMode === 'list' && { backgroundColor: PRIMARY_COLOR },
              ]}
            >
              <Text
                style={[
                  styles.toggleOptionText,
                  { color: viewMode === 'list' ? '#ffffff' : theme.muted },
                ]}
              >
                📋 List
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={[styles.loadingText, { color: theme.muted }]}>Loading Abuja pharmacies...</Text>
          </View>
        ) : viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            {/* Apple Maps on iOS via PROVIDER_DEFAULT */}
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              initialRegion={ABUJA_REGION}
              showsUserLocation={false}
              showsCompass={true}
              showsScale={true}
            >
              {filteredPharmacies.map((pharmacy) => {
                if (!pharmacy.lat || !pharmacy.lng) return null;
                const isSelected = selectedPharmacy?.placeId === pharmacy.placeId;

                return (
                  <Marker
                    key={pharmacy.placeId}
                    coordinate={{
                      latitude: pharmacy.lat,
                      longitude: pharmacy.lng,
                    }}
                    title={pharmacy.name}
                    description={pharmacy.address}
                    pinColor={isSelected ? '#0EA5E9' : '#0B57D0'}
                    onPress={() => handleSelectPharmacy(pharmacy)}
                  />
                );
              })}
            </MapView>

            {/* Selected Pharmacy Detail Callout Card */}
            {selectedPharmacy && (
              <View style={[styles.calloutCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.calloutHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.pharmacyName, { color: theme.text }]} numberOfLines={1}>
                      {selectedPharmacy.name}
                    </Text>
                    <Text style={[styles.pharmacyAddress, { color: theme.muted }]} numberOfLines={2}>
                      {selectedPharmacy.address}
                    </Text>
                  </View>
                  {selectedPharmacy.rating !== null && (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>★ {selectedPharmacy.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.calloutFooter}>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: selectedPharmacy.openNow ? '#10B981' : '#F59E0B' },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: theme.muted }]}>
                      {selectedPharmacy.openNow === true
                        ? 'Open Now'
                        : selectedPharmacy.openNow === false
                        ? 'Closed'
                        : 'Hours Unverified'}
                    </Text>
                    <Text style={[styles.districtTag, { color: theme.mutedLight }]}>
                      · {selectedPharmacy.district}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenDirections(selectedPharmacy)}
                    style={[styles.directionsBtn, { backgroundColor: PRIMARY_COLOR }]}
                  >
                    <Text style={styles.directionsBtnText}>Directions ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredPharmacies.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🏥</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No pharmacies found</Text>
                <Text style={[styles.emptySub, { color: theme.muted }]}>Try selecting "All" districts or a neighboring area.</Text>
              </View>
            ) : (
              filteredPharmacies.map((pharmacy) => {
                const isSelected = selectedPharmacy?.placeId === pharmacy.placeId;
                return (
                  <TouchableOpacity
                    key={pharmacy.placeId}
                    activeOpacity={0.7}
                    onPress={() => {
                      handleSelectPharmacy(pharmacy);
                      setViewMode('map');
                    }}
                    style={[
                      styles.listItem,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSelected ? PRIMARY_COLOR : theme.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.listItemName, { color: theme.text }]}>{pharmacy.name}</Text>
                        {pharmacy.rating !== null && (
                          <Text style={styles.ratingInline}>★ {pharmacy.rating.toFixed(1)}</Text>
                        )}
                      </View>
                      <Text style={[styles.listItemAddress, { color: theme.muted }]}>{pharmacy.address}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: pharmacy.openNow ? '#10B981' : '#F59E0B' },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: theme.muted }]}>
                          {pharmacy.openNow === true
                            ? 'Open Now'
                            : pharmacy.openNow === false
                            ? 'Closed'
                            : 'Hours Unverified'}
                        </Text>
                        <Text style={[styles.districtTag, { color: theme.mutedLight }]}>
                          · {pharmacy.district} District
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenDirections(pharmacy)}
                      style={[styles.miniDirectionsBtn, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.miniDirectionsText, { color: PRIMARY_COLOR }]}>Navigate</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  fallbackBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  filterSection: {
    paddingVertical: 10,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  districtChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  districtChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  comingSoonText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  togglePill: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
  },
  toggleOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  calloutCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  pharmacyAddress: {
    fontSize: 12,
    lineHeight: 16,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  calloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  districtTag: {
    fontSize: 11,
  },
  directionsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  directionsBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratingInline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  listItemAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  miniDirectionsBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniDirectionsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyList: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
