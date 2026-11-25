// Trip builder. One scrolling page of playful cards rather than a form.
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uid } from '@/data/repo';
import type { Budget, Interest, Place, Transport, TravelStyle, Trip } from '@/data/types';
import { useStore } from '@/state/store';
import { searchPlaces, reverseGeocode } from '@/services/geocoding';
import { getRoute } from '@/services/routing';
import { locateOnce } from '@/services/location';
import { fmtKm, fmtMin } from '@/services/geo';
import { BUDGETS, INTERESTS, STYLES, TRANSPORT } from '@/content/options';
import { color, radius, space } from '@/theme/tokens';
import { Button, Chip, Icon, Press, T } from '@/components/ui/primitives';
import { PlaceSearch } from '@/components/ui/PlaceSearch';

const DETOURS = [5, 10, 20, 40, 80];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Plan() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string; to?: string; toLat?: string; toLng?: string; interests?: string; title?: string }>();
  const { profile, saveTrip } = useStore();
  const prefs = profile?.prefs;

  const [origin, setOrigin] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(params.toLat && params.to ? { name: params.to, lat: +params.toLat, lng: +params.toLng! } : null);
  const [openEnded, setOpenEnded] = useState(false);
  const [startOffset, setStartOffset] = useState(0);
  const [days, setDays] = useState(2);
  const [transport, setTransport] = useState<Transport>(prefs?.transport ?? 'driving');
  const [maxKm, setMaxKm] = useState(prefs?.maxDetourKm ?? 20);
  const [budget, setBudget] = useState<Budget>(prefs?.budget ?? 'moderate');
  const [interests, setInterests] = useState<Interest[]>(params.interests ? (params.interests.split(',') as Interest[]) : prefs?.interests ?? []);
  const [style, setStyle] = useState<TravelStyle>(prefs?.style ?? 'spontaneous');
  const [locBusy, setLocBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ km: number; min: number; source: string } | null>(null);

  // Prefill named places (road trips) by geocoding their names.
  useEffect(() => {
    (async () => {
      try {
        if (params.from && !origin) { const r = await searchPlaces(params.from); if (r[0]) setOrigin(r[0]); }
        if (params.to && !dest) { const r = await searchPlaces(params.to); if (r[0]) setDest(r[0]); }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live route preview once both ends are set.
  useEffect(() => {
    setPreview(null);
    if (!origin || !dest || openEnded) return;
    let live = true;
    getRoute([origin, dest], transport).then((r) => live && setPreview({ km: r.distanceM / 1000, min: r.durationS / 60, source: r.source })).catch(() => {});
    return () => { live = false; };
  }, [origin, dest, transport, openEnded]);

  const dates = useMemo(() => Array.from({ length: 60 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);

  async function useMyLocation() {
    setLocBusy(true); setErr(null);
    try { const p = await locateOnce(); setOrigin(await reverseGeocode(p.lat, p.lng)); }
    catch { setErr('Location is not available. Type your starting point instead.'); }
    finally { setLocBusy(false); }
  }

  async function create() {
    setErr(null);
    if (!origin) return setErr('Where are you starting from?');
    if (!openEnded && !dest) return setErr('Pick a destination, or switch on “Open-ended”.');
    setBusy(true);
    try {
      const start = dates[startOffset];
      const end = new Date(start); end.setDate(end.getDate() + days - 1);
      const route = !openEnded && dest ? await getRoute([origin, dest], transport) : undefined;
      const trip: Trip = {
        id: uid(),
        title: params.title ?? (openEnded || !dest ? `Around ${origin.name}` : `${origin.name} to ${dest.name}`),
        origin, destination: openEnded ? undefined : dest ?? undefined,
        startDate: iso(start), endDate: iso(end), days, status: 'planned', transport, budget, interests, style,
        maxDetourKm: maxKm, route, stops: [], notes: [], createdAt: new Date().toISOString(),
      };
      await saveTrip(trip);
      router.replace(`/trip/${trip.id}`);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not create the trip. Try again.');
    } finally { setBusy(false); }
  }

  const toggle = (k: Interest) => setInterests((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.white }}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Press onPress={() => router.back()} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={24} /></Press>
        <T v="kicker" c={color.teal}>New adventure</T>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + 140, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <T v="h1">{params.title ?? 'Where will the road take you?'}</T>

        <Block i={0} icon="flag-outline" title="Route">
          <View style={{ gap: space.md }}>
            <PlaceSearch placeholder="Starting from" icon="radio-button-on" value={origin} onPick={setOrigin} />
            <Button small v="ghost" icon="locate" label="Use my current location" loading={locBusy} onPress={useMyLocation} style={{ alignSelf: 'flex-start' }} />
            {!openEnded ? <PlaceSearch placeholder="Going to" icon="location" value={dest} onPick={setDest} near={origin ?? undefined} /> : null}
            <Press onPress={() => setOpenEnded((o) => !o)} accessibilityRole="switch" accessibilityState={{ checked: openEnded }} accessibilityLabel="Open-ended exploration, no fixed destination"
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: openEnded ? color.ocean : color.cream }}>
              <Icon name="infinite-outline" size={22} color={openEnded ? color.sand : color.teal} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" c={openEnded ? color.white : color.ink}>Open-ended</T>
                <T v="micro" c={openEnded ? 'rgba(248,247,243,0.8)' : color.inkSoft}>No destination. Explore around your starting point.</T>
              </View>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: openEnded ? color.sand : '#CFC6B5', padding: 3, alignItems: openEnded ? 'flex-end' : 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
              </View>
            </Press>
            {preview ? (
              <View style={{ flexDirection: 'row', gap: space.lg, paddingTop: space.xs }}>
                <T v="small" c={color.teal}>{fmtKm(preview.km)} · {fmtMin(preview.min)} without stops</T>
                <T v="micro" c={color.gray}>{preview.source === 'straight-line' ? 'straight line — routing unavailable' : `via ${preview.source.toUpperCase()}`}</T>
              </View>
            ) : null}
          </View>
        </Block>

        <Block i={1} icon="calendar-outline" title="When">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {dates.map((d, i) => {
              const on = i === startOffset;
              const inRange = i > startOffset && i < startOffset + days;
              return (
                <Press key={i} onPress={() => setStartOffset(i)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={d.toDateString()}
                  style={{ width: 56, height: 72, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.ocean : inRange ? color.sand : '#FFF', borderWidth: 1, borderColor: on ? color.ocean : color.line }}>
                  <T v="micro" c={on ? color.sand : color.inkSoft}>{i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</T>
                  <T v="h3" c={on ? color.white : color.ink}>{d.getDate()}</T>
                  <T v="micro" c={on ? 'rgba(248,247,243,0.7)' : color.gray}>{d.toLocaleDateString(undefined, { month: 'short' })}</T>
                </Press>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md }}>
            <T v="bodyStrong">{days} day{days === 1 ? '' : 's'}</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stepper icon="remove" label="Fewer days" onPress={() => setDays((d) => Math.max(1, d - 1))} />
              <Stepper icon="add" label="More days" onPress={() => setDays((d) => Math.min(30, d + 1))} />
            </View>
          </View>
        </Block>

        <Block i={2} icon="car-outline" title="Getting around">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {TRANSPORT.map((t) => <View key={t.key} style={{ flex: 1 }}><Chip label={t.label} icon={t.icon} selected={transport === t.key} onPress={() => setTransport(t.key)} /></View>)}
          </View>
          <T v="label" c={color.inkSoft} style={{ marginTop: space.lg }}>How far off the route will you go?</T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: space.sm }}>
            {DETOURS.map((k) => (
              <Press key={k} onPress={() => setMaxKm(k)} accessibilityRole="radio" accessibilityState={{ selected: maxKm === k }} accessibilityLabel={`${k} kilometres`}
                style={{ flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: maxKm >= k ? color.teal : color.cream }}>
                <T v="label" c={maxKm >= k ? color.white : color.charcoal}>{k}</T>
              </Press>
            ))}
          </View>
          <T v="micro" c={color.gray} style={{ marginTop: 4 }}>km from your route</T>
          <T v="label" c={color.inkSoft} style={{ marginTop: space.lg }}>Budget</T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: space.sm, flexWrap: 'wrap' }}>
            {BUDGETS.map((b) => <Chip key={b.key} label={`${b.sign} ${b.label}`} selected={budget === b.key} onPress={() => setBudget(b.key)} />)}
          </View>
        </Block>

        <Block i={3} icon="heart-outline" title="What you're into">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {INTERESTS.map((i) => <Chip key={i.key} label={i.label} icon={i.icon} selected={interests.includes(i.key)} onPress={() => toggle(i.key)} />)}
          </View>
          <T v="label" c={color.inkSoft} style={{ marginTop: space.lg }}>Travel style</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: space.sm }}>
            {STYLES.map((s) => <Chip key={s.key} label={s.label} icon={s.icon} selected={style === s.key} onPress={() => setStyle(s.key)} />)}
          </ScrollView>
        </Block>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, paddingBottom: insets.bottom + space.lg, backgroundColor: 'rgba(248,247,243,0.97)', borderTopWidth: 1, borderTopColor: color.line, gap: space.sm }}>
        {err ? <T v="small" c={color.danger} accessibilityRole="text">{err}</T> : null}
        <Button label="Create my adventure" icon="sparkles" loading={busy} onPress={create} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Block({ i, icon, title, children }: { i: number; icon: string; title: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 * i).springify().damping(18)} style={{ backgroundColor: '#FFF', borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: color.line, gap: space.md, zIndex: 10 - i }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.cream, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={17} color={color.teal} /></View>
        <T v="h3">{title}</T>
      </View>
      {children}
    </Animated.View>
  );
}

function Stepper({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
      <Icon name={icon} size={20} />
    </Press>
  );
}
