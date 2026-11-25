'use client';
// Animated journey map for the public story: the route draws itself, stops pop in as it passes.
import { useEffect, useRef, useState } from 'react';

const JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';

type Stop = { name: string; lat: number; lng: number };

function load(): Promise<any> {
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  return new Promise((res, rej) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = JS; s.onload = () => res(w.maplibregl); s.onerror = rej; document.head.appendChild(s);
  });
}

export default function JourneyMap({ route, stops }: { route: [number, number][] | null; stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(stops[0]?.name ?? '');
  const [err, setErr] = useState(false);

  useEffect(() => {
    let map: any, raf = 0, dead = false;
    const line: [number, number][] = route?.length ? route : stops.map((s) => [s.lng, s.lat]);
    load().then((ml) => {
      if (dead || !el.current || line.length < 2) return;
      map = new ml.Map({ container: el.current, style: 'https://tiles.openfreemap.org/styles/positron', center: line[0], zoom: 6, attributionControl: { compact: true }, cooperativeGestures: true });
      const b = new ml.LngLatBounds(line[0], line[0]); line.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 60, duration: 0 });
      map.on('load', () => {
        map.addSource('r', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [line[0], line[0]] } } });
        map.addLayer({ id: 'c', type: 'line', source: 'r', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F8F7F3', 'line-width': 9 } });
        map.addLayer({ id: 'l', type: 'line', source: 'r', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#183C50', 'line-width': 4.5 } });
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const idx = stops.map((s) => { let bi = 0, bd = Infinity; line.forEach(([x, y], i) => { const d = (x - s.lng) ** 2 + (y - s.lat) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; });
        const shown = new Set<number>();
        const pin = (i: number) => {
          if (shown.has(i)) return; shown.add(i);
          const d = document.createElement('div');
          d.style.cssText = 'width:28px;height:28px;border-radius:14px;background:#183C50;border:2px solid #F8F7F3;color:#F8F7F3;display:grid;place-items:center;font:700 12px Roboto,system-ui;box-shadow:0 6px 14px rgba(15,42,56,.35)';
          d.textContent = i === 0 ? 'A' : i === stops.length - 1 ? 'B' : String(i);
          d.title = stops[i].name;
          new ml.Marker({ element: d }).setLngLat([stops[i].lng, stops[i].lat]).addTo(map);
          setLabel(stops[i].name);
        };
        const t0 = performance.now(), D = reduce ? 1 : Math.min(9000, 2500 + line.length * 4);
        const step = (now: number) => {
          const f = Math.min(1, (now - t0) / D);
          const n = Math.max(2, Math.round(f * (line.length - 1)) + 1);
          map.getSource('r').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.slice(0, n) } });
          idx.forEach((k, i) => { if (k <= n - 1) pin(i); });
          if (f < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      });
    }).catch(() => setErr(true));
    return () => { dead = true; cancelAnimationFrame(raf); map?.remove(); };
  }, [route, stops]);

  return (
    <div style={{ position: 'relative', height: 460, borderRadius: 22, overflow: 'hidden', background: '#EDE8DE' }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} aria-label="Animated map of the journey" />
      {err ? <p style={{ padding: 24 }}>The map could not load.</p> : null}
      {label ? <div style={{ position: 'absolute', left: 16, bottom: 16, background: 'rgba(248,247,243,.95)', borderRadius: 999, padding: '10px 18px', font: '600 14px var(--sans)' }}>{label}</div> : null}
    </div>
  );
}
