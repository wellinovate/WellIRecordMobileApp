import { useCallback, useEffect, useRef, useState } from 'react';
import { getDevicePosition, type Position } from '../utils/nearby';

export type LocState = 'locating' | 'ok' | 'denied' | 'unavailable';

interface Fetched<T> { items: T[]; usedFallback: boolean; radiusKm?: number }

// Finds the phone's position, then loads the directory around it. Without a position (permission
// refused or no fix) it loads the default list so the screen is never empty-handed.
export function useNearbyDirectory<T extends { placeId: string }>(
  visible: boolean,
  fetcher: (pos?: Position) => Promise<Fetched<T>>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [pos, setPos] = useState<Position | null>(null);
  const [loc, setLoc] = useState<LocState>('locating');
  const [usedFallback, setUsedFallback] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const run = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    setLoc('locating');
    const got = await getDevicePosition();
    if (id !== run.current) return;
    const p = got.ok ? got.pos : undefined;
    setPos(p ?? null);
    setLoc(got.ok ? 'ok' : got.reason);
    try {
      const r = await fetchRef.current(p);
      if (id !== run.current) return;
      setItems(r.items);
      setUsedFallback(r.usedFallback);
      setRadiusKm(r.radiusKm);
    } catch (e) {
      console.error('[useNearbyDirectory] load error:', e);
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) { run.current++; return; }
    load();
    return () => { run.current++; };
  }, [visible, load]);

  return { items, pos, loc, usedFallback, radiusKm, loading, reload: load };
}
