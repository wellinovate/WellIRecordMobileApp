// Nearby labs and pharmacies around a point the phone sends, using Google Places API (New).
export type PlaceKind = 'lab' | 'pharmacy' | 'hospital' | 'clinic' | 'maternity';
export const PLACE_KINDS: PlaceKind[] = ['lab', 'pharmacy', 'hospital', 'clinic', 'maternity'];

export interface NearbyPlace {
  placeId: string;
  name: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  rating: number | null;
  openNow: boolean | null;
  distanceKm: number;
}

export const ABUJA_CENTER = { lat: 9.0765, lng: 7.4586 };
export const ABUJA_FALLBACK_RADIUS_KM = 60;
const RADII_M = [8000, 25000, 50000];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

export function parseCoords(q: { lat?: unknown; lng?: unknown }): { lat: number; lng: number } | null {
  if (q.lat === undefined || q.lng === undefined || q.lat === '' || q.lng === '') return null;
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const nearAbuja = (p: { lat: number; lng: number }) => distanceKm(p, ABUJA_CENTER) <= ABUJA_FALLBACK_RADIUS_KM;

export function mapPlace(place: any, origin: { lat: number; lng: number }): NearbyPlace | null {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  const name = place?.displayName?.text;
  if (!place?.id || !name || typeof lat !== 'number' || typeof lng !== 'number') return null;
  const address = String(place.shortFormattedAddress || place.formattedAddress || '');
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    placeId: place.id,
    name,
    address,
    district: parts.length > 1 ? parts[parts.length - 1] : '',
    lat,
    lng,
    rating: typeof place.rating === 'number' ? place.rating : null,
    openNow: typeof place.currentOpeningHours?.openNow === 'boolean' ? place.currentOpeningHours.openNow : null,
    distanceKm: Math.round(distanceKm(origin, { lat, lng }) * 10) / 10,
  };
}

// Places API (New). Types come from Google's table A; kinds without a clean type use a text query.
export interface PlacesRequest { url: string; headers: Record<string, string>; body: unknown }

const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.rating,places.currentOpeningHours.openNow';
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

export function nearbyRequest(kind: PlaceKind, p: { lat: number; lng: number }, radiusM: number, key: string): PlacesRequest {
  const circle = { center: { latitude: p.lat, longitude: p.lng }, radius: radiusM };
  const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK };
  if (kind === 'pharmacy' || kind === 'hospital') {
    return { url: NEARBY_URL, headers, body: { includedTypes: [kind], maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle } } };
  }
  const textQuery = kind === 'clinic' ? 'clinic' : kind === 'maternity' ? 'maternity hospital' : 'diagnostic laboratory';
  return { url: TEXT_URL, headers, body: { textQuery, maxResultCount: 20, rankPreference: 'DISTANCE', locationBias: { circle } } };
}

export type JsonFetch = (req: PlacesRequest, ms: number) => Promise<any>;

// Searches a widening circle until something is found. Results are sorted nearest first.
export async function searchNearby(kind: PlaceKind, p: { lat: number; lng: number }, key: string, getJson: JsonFetch) {
  for (const radius of RADII_M) {
    const data = await getJson(nearbyRequest(kind, p, radius, key), 6000);
    if (data?.error) throw new Error(`Places ${data.error.status || data.error.code}: ${data.error.message || ''}`.trim());
    const list: any[] = Array.isArray(data?.places) ? data.places : [];
    const seen = new Set<string>();
    const places = list
      .map((r) => mapPlace(r, p))
      .filter((x: NearbyPlace | null): x is NearbyPlace => Boolean(x) && x!.distanceKm <= radius / 1000 && !seen.has(x!.placeId) && Boolean(seen.add(x!.placeId)))
      .sort((a: NearbyPlace, b: NearbyPlace) => a.distanceKm - b.distanceKm);
    if (places.length) return { places, radiusKm: radius / 1000 };
  }
  return { places: [] as NearbyPlace[], radiusKm: RADII_M[RADII_M.length - 1] / 1000 };
}

const cache = new Map<string, { at: number; value: { places: NearbyPlace[]; radiusKm: number } }>();

// Coordinates are rounded to about 1 km so nearby phones share one Places call. Distances are then
// recomputed from the caller's exact point.
export async function nearbyCached(kind: PlaceKind, p: { lat: number; lng: number }, key: string, getJson: JsonFetch, now = Date.now()) {
  const cell = { lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 };
  const k = `${kind}:${cell.lat}:${cell.lng}`;
  let hit = cache.get(k);
  if (!hit || now - hit.at > CACHE_TTL_MS) {
    const value = await searchNearby(kind, cell, key, getJson);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    hit = { at: now, value };
    cache.set(k, hit);
  }
  const places = hit.value.places
    .map((x) => ({ ...x, distanceKm: Math.round(distanceKm(p, x) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return { places, radiusKm: hit.value.radiusKm };
}

export function clearNearbyCache() { cache.clear(); }
