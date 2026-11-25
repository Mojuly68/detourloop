// Place search. Mapbox Geocoding with a token; otherwise Photon (Komoot, OpenStreetMap data, fair use).
import type { Place } from '@/data/types';
import { config } from './config';

export async function searchPlaces(query: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (config.mapboxToken) {
    try {
      const prox = near ? `&proximity=${near.lng},${near.lat}` : '';
      const r = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&limit=6${prox}&access_token=${config.mapboxToken}`,
        { signal },
      );
      if (r.ok) {
        const j = await r.json();
        return (j.features ?? []).map((f: any) => ({
          name: f.properties.name,
          context: f.properties.place_formatted,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }

  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}`, { signal });
  if (!r.ok) throw new Error(`Search failed (${r.status})`);
  const j = await r.json();
  const seen = new Set<string>();
  return (j.features ?? [])
    .map((f: any) => {
      const p = f.properties ?? {};
      const kind = p.type === 'county' ? 'County' : p.type === 'state' ? 'State / region' : p.type === 'country' ? 'Country' : undefined;
      const ctx = [kind, p.city !== p.name ? p.city : undefined, p.state !== p.name ? p.state : undefined, p.country].filter(Boolean).join(', ');
      return { name: p.name ?? p.city ?? q, context: ctx || undefined, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } as Place;
    })
    .filter((p: Place) => {
      const k = `${p.name}|${p.context}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`);
    const j = await r.json();
    const p = j.features?.[0]?.properties;
    if (p) return { name: p.city ?? p.name ?? 'Current location', context: [p.state, p.country].filter(Boolean).join(', '), lat, lng };
  } catch {}
  return { name: 'Current location', lat, lng };
}
