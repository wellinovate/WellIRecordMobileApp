import * as Location from 'expo-location';

export interface Position { lat: number; lng: number }
export type PositionResult = { ok: true; pos: Position } | { ok: false; reason: 'denied' | 'unavailable' };

// Asks for foreground location once and returns a fix. A recent cached fix is used first so the
// list appears quickly; otherwise a balanced fix (city-block accuracy is enough) is requested.
export async function getDevicePosition(): Promise<PositionResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
    const fix = last ?? (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 12000)),
    ]));
    if (!fix) return { ok: false, reason: 'unavailable' };
    return { ok: true, pos: { lat: fix.coords.latitude, lng: fix.coords.longitude } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export function formatDistance(km: number | undefined): string {
  if (km === undefined || !Number.isFinite(km)) return '';
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function regionAround(pos: Position, radiusKm = 5) {
  const d = Math.max(0.02, (radiusKm / 111) * 2);
  return { latitude: pos.lat, longitude: pos.lng, latitudeDelta: d, longitudeDelta: d };
}
