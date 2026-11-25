// Route calculation. Mapbox Directions when a token is configured, else the public OSRM
// servers run by FOSSGIS (routing.openstreetmap.de, fair use, not for heavy production traffic).
// If both fail, a straight line is returned and labelled as such — never presented as a road route.
import type { LngLat, Place, Route, Transport } from '@/data/types';
import { config } from './config';
import { haversineKm, lineLengthKm, samplePoints, AVG_KMH } from './geo';

const OSRM: Record<Transport, string> = {
  driving: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
};

async function fetchJson(url: string, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function getRoute(points: { lat: number; lng: number }[], mode: Transport): Promise<Route> {
  if (points.length < 2) throw new Error('A route needs at least two points');
  const coordStr = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

  if (config.mapboxToken) {
    try {
      const profile = mode === 'driving' ? 'driving' : mode;
      const j = await fetchJson(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&overview=full&access_token=${config.mapboxToken}`,
      );
      const r = j.routes?.[0];
      if (r) return { coords: samplePoints(r.geometry.coordinates, 1500), distanceM: r.distance, durationS: r.duration, source: 'mapbox' };
    } catch (e) {
      console.warn('Mapbox directions failed, falling back to OSRM', e);
    }
  }

  try {
    const j = await fetchJson(`${OSRM[mode]}/${coordStr}?overview=full&geometries=geojson`);
    const r = j.routes?.[0];
    if (r) return { coords: samplePoints(r.geometry.coordinates, 1500), distanceM: r.distance, durationS: r.duration, source: 'osrm' };
  } catch (e) {
    console.warn('OSRM failed, using straight line', e);
  }

  const coords: LngLat[] = points.map((p) => [p.lng, p.lat]);
  const km = lineLengthKm(coords);
  return { coords, distanceM: km * 1000, durationS: (km / AVG_KMH[mode]) * 3600, source: 'straight-line' };
}

/** Route for a trip: origin → stops (in order, skipping skipped ones) → destination. */
export function tripWaypoints(origin: Place, stops: { lat: number; lng: number; status?: string }[], destination?: Place) {
  const pts = [origin, ...stops.filter((s) => s.status !== 'skipped'), ...(destination ? [destination] : [])];
  // OSRM / Mapbox cap waypoints at 25.
  return pts.slice(0, 25);
}

/** Insert a stop into the stop list where it adds the least distance. */
export function bestInsertIndex<T extends { lat: number; lng: number }>(origin: Place, stops: T[], destination: Place | undefined, p: { lat: number; lng: number }) {
  const seq = [origin, ...stops, ...(destination ? [destination] : [])];
  if (seq.length < 2) return stops.length;
  let best = Infinity, bestI = stops.length;
  for (let i = 0; i < seq.length - 1; i++) {
    const added = haversineKm(seq[i], p) + haversineKm(p, seq[i + 1]) - haversineKm(seq[i], seq[i + 1]);
    if (added < best) { best = added; bestI = i; }
  }
  return Math.min(bestI, stops.length);
}

/** Deep link to turn-by-turn navigation in the platform map app. */
export function navigationLinks(p: { lat: number; lng: number; name?: string }) {
  const q = encodeURIComponent(p.name ?? `${p.lat},${p.lng}`);
  return {
    apple: `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,
  };
}
