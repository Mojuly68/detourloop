import type { Discovery, Trip } from '@/data/types';
import { CATEGORY_GLYPH } from '@/content/options';
import type { MapMarker } from './runtime';

export function tripMarkers(trip: Trip, discoveries: Discovery[] = [], me?: { lat: number; lng: number } | null): MapMarker[] {
  const out: MapMarker[] = [{ id: 'origin', kind: 'origin', lat: trip.origin.lat, lng: trip.origin.lng, label: trip.origin.name }];
  let n = 0;
  trip.stops.forEach((s) => {
    if (s.status === 'skipped') return;
    out.push({ id: s.id, kind: 'stop', lat: s.lat, lng: s.lng, n: ++n, label: s.name });
  });
  if (trip.destination) out.push({ id: 'dest', kind: 'dest', lat: trip.destination.lat, lng: trip.destination.lng, label: trip.destination.name });
  const taken = new Set(trip.stops.map((s) => s.placeId));
  discoveries.filter((d) => !taken.has(d.placeId)).forEach((d) => out.push({ id: d.placeId, kind: 'discovery', lat: d.lat, lng: d.lng, icon: CATEGORY_GLYPH[d.category] ?? '•', label: d.name }));
  if (me) out.push({ id: 'me', kind: 'me', lat: me.lat, lng: me.lng, label: 'You are here' });
  return out;
}
