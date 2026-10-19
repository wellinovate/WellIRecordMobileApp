// Nearby labs and pharmacies around a point the phone sends, using Google Places Nearby Search.
export type PlaceKind = 'lab' | 'pharmacy';

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
  const lat = place?.geometry?.location?.lat;
  const lng = place?.geometry?.location?.lng;
  if (!place?.place_id || !place?.name || typeof lat !== 'number' || typeof lng !== 'number') return null;
  const address = String(place.vicinity || place.formatted_address || '');
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    placeId: place.place_id,
    name: place.name,
    address,
    district: parts.length > 1 ? parts[parts.length - 1] : '',
    lat,
    lng,
    rating: typeof place.rating === 'number' ? place.rating : null,
    openNow: place.opening_hours?.open_now ?? null,
    distanceKm: Math.round(distanceKm(origin, { lat, lng }) * 10) / 10,
  };
}

export function nearbyUrl(kind: PlaceKind, p: { lat: number; lng: number }, radiusM: number, key: string): string {
  const params = new URLSearchParams({ location: `${p.lat},${p.lng}`, radius: String(radiusM), key });
  if (kind === 'pharmacy') params.set('type', 'pharmacy');
  else params.set('keyword', 'diagnostic laboratory');
  return `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
}

export type JsonFetch = (url: string, ms: number) => Promise<any>;

// Searches a widening circle until something is found. Results are sorted nearest first.
export async function searchNearby(kind: PlaceKind, p: { lat: number; lng: number }, key: string, getJson: JsonFetch) {
  for (const radius of RADII_M) {
    const data = await getJson(nearbyUrl(kind, p, radius, key), 6000);
    if (data?.status === 'OK' && Array.isArray(data.results)) {
      const seen = new Set<string>();
      const places = data.results
        .map((r: any) => mapPlace(r, p))
        .filter((x: NearbyPlace | null): x is NearbyPlace => Boolean(x) && !seen.has(x!.placeId) && Boolean(seen.add(x!.placeId)))
        .sort((a: NearbyPlace, b: NearbyPlace) => a.distanceKm - b.distanceKm);
      if (places.length) return { places, radiusKm: radius / 1000 };
    } else if (data?.status && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places ${data.status}`);
    }
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
