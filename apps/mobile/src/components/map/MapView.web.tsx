// Web map: loads MapLibre GL JS (UMD, pinned) once, then runs the shared runtime in a div.
import React, { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { config } from '@/services/config';
import { color } from '@/theme/tokens';
import { T } from '@/components/ui/primitives';
import { MAPLIBRE_CSS, MAPLIBRE_JS, RUNTIME, type MapProps } from './runtime';

let loader: Promise<any> | null = null;
function loadMapLibre(): Promise<any> {
  const w = window as any;
  if (w.maplibregl && w.createDetourMap) return Promise.resolve(w.maplibregl);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = MAPLIBRE_JS;
    s.async = true;
    s.onload = () => {
      // eslint-disable-next-line no-new-func
      new Function(RUNTIME)();
      resolve(w.maplibregl);
    };
    s.onerror = () => { loader = null; reject(new Error('Map library failed to load')); };
    document.head.appendChild(s);
  });
  return loader;
}

export default function MapView({ style, onMarkerPress, onMapPress, ...props }: MapProps & { style?: StyleProp<ViewStyle>; onMarkerPress?: (id: string) => void; onMapPress?: () => void }) {
  const host = useRef<any>(null);
  const api = useRef<any>(null);
  const handlers = useRef({ onMarkerPress, onMapPress });
  handlers.current = { onMarkerPress, onMapPress };
  const [err, setErr] = useState<string | null>(null);
  const full = { ...props, mapboxToken: config.mapboxToken };
  const latest = useRef(full);
  latest.current = full;

  useEffect(() => {
    let dead = false;
    loadMapLibre()
      .then((ml) => {
        if (dead || !host.current) return;
        const el = host.current as unknown as HTMLElement;
        api.current = (window as any).createDetourMap(ml, el, (e: any) => {
          if (e.type === 'marker') handlers.current.onMarkerPress?.(e.id);
          if (e.type === 'mapclick') handlers.current.onMapPress?.();
          if (e.type === 'ready') api.current?.update(latest.current);
        }, latest.current);
      })
      .catch((e) => setErr(e.message));
    return () => { dead = true; api.current?.destroy(); api.current = null; };
  }, []);

  useEffect(() => { api.current?.update(full); });

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => api.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <View style={[{ backgroundColor: '#EDE8DE', overflow: 'hidden' }, style]}>
      <View ref={host} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Map" />
      {err ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <T v="small" c={color.inkSoft}>The map could not load ({err}). Your trip and stops still work below.</T>
        </View>
      ) : null}
    </View>
  );
}
