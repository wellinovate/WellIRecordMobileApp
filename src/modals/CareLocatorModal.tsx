import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Modal } from '../components/ActivityModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ModalHeader } from '../components/ModalHeader';
import { useTheme } from '../theme/ThemeContext';
import { careService, type NearbyPlaceItem as LabDirectoryItem, type PlaceKind } from '../services/careService';
import { hapticFeedback } from '../utils/haptics';
import { formatDistance, regionAround } from '../utils/nearby';
import { useNearbyDirectory } from '../hooks/useNearbyDirectory';
import { NearbyBar } from '../components/NearbyBar';
import { WelliBadge } from '../components/WelliBadge';
import type { WelliApp } from '../state/useWelliApp';

const PRIMARY_COLOR = '#0EA5E9';
const BOOK_COLOR = '#059669';

// Abuja is the default map region when the phone gives no location
const ABUJA_REGION = {
  latitude: 9.0765,
  longitude: 7.4586,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export function CareLocatorModal({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  const mapRef = useRef<MapView>(null);
  const [kind, setKind] = useState<PlaceKind>('hospital');

  const [selectedLab, setSelectedLab] = useState<LabDirectoryItem | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  // If map tiles never load (invalid/restricted Google Maps key, no network),
  // Android shows a blank grid. Fall back to the list instead of a white screen.
  useEffect(() => {
    if (!state.showCareLocator) {
      setMapLoaded(false);
      setMapFailed(false);
      return;
    }
    if (viewMode !== 'map' || mapLoaded) return;
    const timer = setTimeout(() => {
      setMapFailed(true);
      setViewMode('list');
    }, 7000);
    return () => clearTimeout(timer);
  }, [state.showCareLocator, viewMode, mapLoaded]);

  const isVisible = Boolean(state.showCareLocator);

  const { items: labs, pos, loc, radiusKm, loading: isLoading, reload } = useNearbyDirectory<LabDirectoryItem>(
    isVisible,
    async (p) => {
      if (!p) return { items: [], usedFallback: false };
      const r = await careService.fetchPlaces(kind, p);
      return { items: r.places, usedFallback: false, radiusKm: r.radiusKm };
    },
    kind,
  );

  // Select the nearest result when the list changes and move the map to the person (or Abuja).
  useEffect(() => {
    setSelectedLab(labs.length > 0 ? labs[0] : null);
    const region = pos ? regionAround(pos, radiusKm ? Math.min(radiusKm, 10) : 5) : ABUJA_REGION;
    mapRef.current?.animateToRegion(region, 500);
  }, [labs, pos, radiusKm]);

  const noun = kind === 'hospital' ? 'hospitals' : kind === 'clinic' ? 'clinics' : 'maternity centers';

  const filteredLabs = labs;

  const handleSelectLab = (lab: LabDirectoryItem) => {
    hapticFeedback.light();
    setSelectedLab(lab);
    if (lab.lat && lab.lng) {
      mapRef.current?.animateToRegion(
        {
          latitude: lab.lat,
          longitude: lab.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
    }
  };

  const handleOpenDirections = (lab: LabDirectoryItem) => {
    hapticFeedback.selection();
    const query = encodeURIComponent(`${lab.name}, ${lab.address}`);
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

  const handleBookAppointment = (lab: LabDirectoryItem) => {
    hapticFeedback.selection();
    actions.closeCareLocator();
    // A registered provider is booked as a WelliRecord facility, so it is notified. Anything else is a Google listing.
    if (lab.welliRecord && lab.facilityId && app.facilities.some((f) => f.id === lab.facilityId)) {
      actions.openBookAppointment(lab.facilityId);
      return;
    }
    actions.openBookAppointment('', {
      name: lab.name,
      address: lab.address,
      placeId: lab.placeId,
    });
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={actions.closeCareLocator}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ModalHeader
          title="Hospitals, clinics and maternity"
          onClose={actions.closeCareLocator}
        />

        {/* Informational banner: Locator only / distinct from partner facilities */}
        <View style={[styles.disclaimerBar, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <Text style={{ fontSize: 13 }}>📍</Text>
          <Text style={[styles.disclaimerText, { color: theme.muted }]}>
            Providers marked WelliRecord are registered on WelliRecord and listed first. Other results are Google listings that WelliRecord has not checked.
          </Text>
        </View>

        {/* Fallback Notice Banner when Google Places API is offline or returns empty */}
        {mapFailed && viewMode === 'list' && (
          <View style={[styles.fallbackBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Text style={[styles.fallbackBannerText, { color: '#92400E' }]}>
              The map did not load, so the list is shown. Tap Map to try again.
            </Text>
          </View>
        )}

        <NearbyBar needsLocation loc={loc} radiusKm={radiusKm} count={labs.length} noun={noun} onRefresh={reload} />

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {([['hospital', 'Hospitals'], ['clinic', 'Clinics'], ['maternity', 'Maternity']] as const).map(([k, l]) => {
            const on = kind === k;
            return (
              <TouchableOpacity
                key={k}
                activeOpacity={0.7}
                onPress={() => { hapticFeedback.light(); setKind(k); }}
                style={[styles.districtChip, { backgroundColor: on ? PRIMARY_COLOR : theme.surface, borderColor: on ? PRIMARY_COLOR : theme.border }]}
              >
                <Text style={[styles.districtChipText, { color: on ? '#ffffff' : theme.text }]}>{l}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* View Mode Toggle: Map vs List */}
        <View style={styles.viewToggleRow}>
          <View />
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
            <Text style={[styles.loadingText, { color: theme.muted }]}>Finding places near you...</Text>
          </View>
        ) : viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            {/* Apple Maps on iOS via PROVIDER_DEFAULT */}
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              initialRegion={pos ? regionAround(pos, 5) : ABUJA_REGION}
              showsUserLocation={Boolean(pos)}
              showsCompass={true}
              showsScale={true}
              onMapLoaded={() => setMapLoaded(true)}
            >
              {filteredLabs.map((lab) => {
                if (!lab.lat || !lab.lng) return null;
                const isSelected = selectedLab?.placeId === lab.placeId;

                return (
                  <Marker
                    key={lab.placeId}
                    coordinate={{
                      latitude: lab.lat,
                      longitude: lab.lng,
                    }}
                    title={lab.name}
                    description={lab.address}
                    pinColor={isSelected ? '#0EA5E9' : '#0B57D0'}
                    onPress={() => handleSelectLab(lab)}
                  />
                );
              })}
            </MapView>

            {/* Selected Lab Detail Callout Card */}
            {selectedLab && (
              <View style={[styles.calloutCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.calloutHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.labName, { color: theme.text }]} numberOfLines={1}>
                      {selectedLab.name}
                    </Text>
                    {selectedLab.welliRecord ? <View style={{ alignSelf: 'flex-start', marginBottom: 3 }}><WelliBadge /></View> : null}
                    <Text style={[styles.labAddress, { color: theme.muted }]} numberOfLines={2}>
                      {selectedLab.address}
                    </Text>
                  </View>
                  {selectedLab.rating !== null && (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>★ {selectedLab.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.calloutFooter}>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: selectedLab.openNow ? '#10B981' : '#F59E0B' },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: theme.muted }]}>
                      {selectedLab.openNow === true
                        ? 'Open Now'
                        : selectedLab.openNow === false
                        ? 'Closed'
                        : 'Hours Unverified'}
                    </Text>
                    <Text style={[styles.districtTag, { color: theme.mutedLight }]}>
                      · {selectedLab.distanceKm !== undefined ? formatDistance(selectedLab.distanceKm) : selectedLab.district}
                    </Text>
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenDirections(selectedLab)}
                      style={[styles.directionsBtn, { backgroundColor: PRIMARY_COLOR }]}
                    >
                      <Text style={styles.directionsBtnText}>Directions ›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleBookAppointment(selectedLab)}
                      style={[styles.bookBtn, { backgroundColor: BOOK_COLOR }]}
                    >
                      <Text style={styles.bookBtnText}>📅 Book Visit</Text>
                    </TouchableOpacity>
                  </View>
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
            {filteredLabs.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔬</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing found nearby</Text>
                <Text style={[styles.emptySub, { color: theme.muted }]}>Allow location, or try again from a different spot. Results come from Google and are not checked by WelliRecord.</Text>
              </View>
            ) : (
              filteredLabs.map((lab) => {
                const isSelected = selectedLab?.placeId === lab.placeId;
                return (
                  <TouchableOpacity
                    key={lab.placeId}
                    activeOpacity={0.7}
                    onPress={() => {
                      handleSelectLab(lab);
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
                        <Text style={[styles.listItemName, { color: theme.text }]}>{lab.name}</Text>
                        {lab.welliRecord ? <WelliBadge /> : null}
                        {lab.rating !== null && (
                          <Text style={styles.ratingInline}>★ {lab.rating.toFixed(1)}</Text>
                        )}
                      </View>
                      <Text style={[styles.listItemAddress, { color: theme.muted }]}>{lab.address}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: lab.openNow ? '#10B981' : '#F59E0B' },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: theme.muted }]}>
                          {lab.openNow === true
                            ? 'Open Now'
                            : lab.openNow === false
                            ? 'Closed'
                            : 'Hours Unverified'}
                        </Text>
                        <Text style={[styles.districtTag, { color: theme.mutedLight }]}>
                          · {lab.distanceKm !== undefined ? formatDistance(lab.distanceKm) : lab.district + ' District'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 6, alignItems: 'flex-end' }}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleBookAppointment(lab)}
                        style={[styles.miniBookBtn, { backgroundColor: BOOK_COLOR }]}
                      >
                        <Text style={styles.miniBookText}>📅 Book</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenDirections(lab)}
                        style={[styles.miniDirectionsBtn, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.miniDirectionsText, { color: PRIMARY_COLOR }]}>Navigate</Text>
                      </TouchableOpacity>
                    </View>
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
  labName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  labAddress: {
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
    flexDirection: 'column',
    gap: 8,
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
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  directionsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  directionsBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  bookBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bookBtnText: {
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
  miniBookBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  miniBookText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  miniDirectionsBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  miniDirectionsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyList: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
