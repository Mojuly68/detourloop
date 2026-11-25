// Search-as-you-type place picker (debounced, cancellable).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import type { Place } from '@/data/types';
import { searchPlaces } from '@/services/geocoding';
import { color, font, radius, space } from '@/theme/tokens';
import { Icon, Press, T } from './primitives';

export function PlaceSearch({ placeholder, onPick, near, value, autoFocus, dark, icon = 'search' }: { placeholder: string; onPick: (p: Place) => void; near?: { lat: number; lng: number }; value?: Place | null; autoFocus?: boolean; dark?: boolean; icon?: string }) {
  const [q, setQ] = useState(value?.name ?? '');
  const [res, setRes] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => { setQ(value?.name ?? ''); }, [value?.name]);

  useEffect(() => {
    if (!focused || q.trim().length < 2 || q === value?.name) { setRes([]); return; }
    const t = setTimeout(async () => {
      ctl.current?.abort();
      ctl.current = new AbortController();
      setBusy(true); setErr(null);
      try { setRes(await searchPlaces(q, near, ctl.current.signal)); }
      catch (e: any) { if (e?.name !== 'AbortError') setErr('Search is unavailable. Check your connection.'); }
      finally { setBusy(false); }
    }, 320);
    return () => clearTimeout(t);
  }, [q, focused, near?.lat, near?.lng, value?.name]);

  return (
    <View style={{ zIndex: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 54, borderRadius: radius.pill, paddingHorizontal: space.lg, backgroundColor: dark ? 'rgba(248,247,243,0.96)' : '#FFFFFF', borderWidth: 1, borderColor: focused ? color.teal : color.line }}>
        <Icon name={icon} size={19} color={color.teal} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          placeholderTextColor={color.gray}
          autoFocus={autoFocus}
          accessibilityLabel={placeholder}
          returnKeyType="search"
          style={{ flex: 1, fontFamily: font.medium, fontSize: 16, color: color.ink, minHeight: 48, outlineStyle: 'none' } as any}
        />
        {busy ? <ActivityIndicator size="small" color={color.teal} /> : q ? (
          <Press onPress={() => { setQ(''); setRes([]); }} accessibilityLabel="Clear search" style={{ padding: 6 }}><Icon name="close-circle" size={18} color={color.gray} /></Press>
        ) : null}
      </View>
      {focused && (res.length > 0 || err) ? (
        <View style={{ marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: radius.md, borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
          {err ? <T v="small" c={color.danger} style={{ padding: space.lg }}>{err}</T> : null}
          {res.map((p, i) => (
            <Press key={`${p.name}${p.lat}${i}`} scaleTo={0.99} onPress={() => { onPick(p); setQ(p.name); setRes([]); setFocused(false); }} accessibilityLabel={`${p.name}${p.context ? ', ' + p.context : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: color.line }}>
              <Icon name="location-outline" size={18} color={color.teal} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
                {p.context ? <T v="micro" c={color.inkSoft} numberOfLines={1}>{p.context}</T> : null}
              </View>
            </Press>
          ))}
        </View>
      ) : null}
    </View>
  );
}
