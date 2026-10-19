import test from 'node:test';
import assert from 'node:assert/strict';
import { clearNearbyCache, distanceKm, mapPlace, nearAbuja, nearbyCached, nearbyUrl, parseCoords, searchNearby } from '../nearbyPlaces';

const place = (id: string, lat: number, lng: number) => ({ place_id: id, name: id, vicinity: '12 Main St, Ikeja', geometry: { location: { lat, lng } }, rating: 4.2, opening_hours: { open_now: true } });

test('coordinates are validated', () => {
  assert.deepEqual(parseCoords({ lat: '6.5', lng: '3.3' }), { lat: 6.5, lng: 3.3 });
  assert.equal(parseCoords({}), null);
  assert.equal(parseCoords({ lat: 'x', lng: '3' }), null);
  assert.equal(parseCoords({ lat: '91', lng: '3' }), null);
  assert.equal(parseCoords({ lat: '', lng: '' }), null);
});

test('distance and the Abuja check', () => {
  assert.ok(Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 1);
  assert.equal(nearAbuja({ lat: 9.07, lng: 7.47 }), true);
  assert.equal(nearAbuja({ lat: 6.52, lng: 3.37 }), false);
});

test('a place is mapped with its district and skipped when incomplete', () => {
  const m = mapPlace(place('a', 6.6, 3.3), { lat: 6.6, lng: 3.3 })!;
  assert.equal(m.district, 'Ikeja');
  assert.equal(m.distanceKm, 0);
  assert.equal(mapPlace({ name: 'x' }, { lat: 0, lng: 0 }), null);
});

test('url uses the pharmacy type or the lab keyword', () => {
  assert.match(nearbyUrl('pharmacy', { lat: 1, lng: 2 }, 8000, 'K'), /type=pharmacy/);
  assert.match(nearbyUrl('lab', { lat: 1, lng: 2 }, 8000, 'K'), /keyword=diagnostic\+laboratory/);
});

test('the search widens the radius, sorts by distance and drops duplicates', async () => {
  const urls: string[] = [];
  const get = async (u: string) => {
    urls.push(u);
    if (urls.length === 1) return { status: 'ZERO_RESULTS', results: [] };
    return { status: 'OK', results: [place('far', 6.7, 3.4), place('near', 6.601, 3.3), place('far', 6.7, 3.4)] };
  };
  const r = await searchNearby('lab', { lat: 6.6, lng: 3.3 }, 'K', get);
  assert.deepEqual(r.places.map((p) => p.placeId), ['near', 'far']);
  assert.equal(r.radiusKm, 25);
});

test('a Places error is thrown and nothing found returns an empty list', async () => {
  await assert.rejects(searchNearby('lab', { lat: 1, lng: 1 }, 'K', async () => ({ status: 'REQUEST_DENIED' })));
  const r = await searchNearby('lab', { lat: 1, lng: 1 }, 'K', async () => ({ status: 'ZERO_RESULTS' }));
  assert.equal(r.places.length, 0);
});

test('nearby phones share one cached call and keep their own distances', async () => {
  clearNearbyCache();
  let calls = 0;
  const get = async () => { calls++; return { status: 'OK', results: [place('p', 6.6, 3.3)] }; };
  const a = await nearbyCached('pharmacy', { lat: 6.601, lng: 3.301 }, 'K', get, 1000);
  const b = await nearbyCached('pharmacy', { lat: 6.604, lng: 3.299 }, 'K', get, 2000);
  assert.equal(calls, 1);
  assert.notEqual(a.places[0].distanceKm, b.places[0].distanceKm);
  await nearbyCached('pharmacy', { lat: 6.601, lng: 3.301 }, 'K', get, 1000 + 7 * 3600 * 1000);
  assert.equal(calls, 2);
});
