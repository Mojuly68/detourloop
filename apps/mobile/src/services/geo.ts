// Pure geometry helpers. No network.
import type { LngLat, Transport } from '@/data/types';
import { fmtDistance } from './units';

const R = 6371; // km
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distance (km) from a point to a polyline of [lng,lat] pairs, using a local equirectangular projection. */
export function distanceToLineKm(p: { lat: number; lng: number }, line: LngLat[]): { km: number; index: number } {
  if (line.length === 0) return { km: Infinity, index: 0 };
  if (line.length === 1) return { km: haversineKm(p, { lng: line[0][0], lat: line[0][1] }), index: 0 };
  const kx = Math.cos(rad(p.lat)) * 111.32;
  const ky = 110.57;
  let best = Infinity;
  let bestI = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - p.lng) * kx, ay = (line[i][1] - p.lat) * ky;
    const bx = (line[i + 1][0] - p.lng) * kx, by = (line[i + 1][1] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    let t = len ? -(ax * dx + ay * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < best) { best = d; bestI = i; }
  }
  return { km: best, index: bestI };
}

/** Reduce a polyline to at most `max` points, evenly spaced by index (keeps ends). */
export function samplePoints(line: LngLat[], max: number): LngLat[] {
  if (line.length <= max) return line;
  const out: LngLat[] = [];
  const step = (line.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(line[Math.round(i * step)]);
  return out;
}

export function lineLengthKm(line: LngLat[]) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += haversineKm({ lng: line[i - 1][0], lat: line[i - 1][1] }, { lng: line[i][0], lat: line[i][1] });
  return d;
}

/** Average speeds used ONLY for labelled detour estimates (before a real route is calculated). */
export const AVG_KMH: Record<Transport, number> = { driving: 55, cycling: 16, walking: 4.5 };

export function estimateDetourMin(offRouteKm: number, mode: Transport) {
  // There and back, with a 1.3 road-winding factor.
  return Math.round(((offRouteKm * 2 * 1.3) / AVG_KMH[mode]) * 60);
}

export function bbox(points: LngLat[]): [number, number, number, number] | null {
  if (!points.length) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of points) { w = Math.min(w, x); s = Math.min(s, y); e = Math.max(e, x); n = Math.max(n, y); }
  return [w, s, e, n];
}

/** Formats a distance given in km in the person's display units (miles by default). */
export const fmtKm = (km: number) => fmtDistance(km);
export const fmtMin = (min: number) => {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};
