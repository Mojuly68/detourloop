// Trip planner — the DetourLoop discovery engine: real route, real places along it, an itinerary
// that re-routes when stops change.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { confirm } from '@/components/ui/confirm';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Discovery, Trip } from '@/data/types';
import { useStore } from '@/state/store';
import { CATEGORY, categoriesFor, categoryByKey, discoverAlongRoute, discoverNearby, enrich } from '@/services/places';
import { DiscoveryService } from '@/services/ai';
import { fmtKm, fmtMin } from '@/services/geo';
import { color, radius, shadow, space } from '@/theme/tokens';
import { Button, Chip, EmptyState, ErrorState, Icon, IconButton, Pill, Press, Skeleton, SourceTag, T, useToast } from '@/components/ui/primitives';
import { DiscoveryCard } from '@/components/ui/DiscoveryCard';
import { Photo } from '@/components/ui/media';
import MapView from '@/components/map/MapView';
import { tripMarkers } from '@/components/map/markers';
import { tripDateLabel } from '@/components/ui/TripCard';


export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, profile, saved, addStop, removeStop, moveStop, setStopStatus, saveTrip, deleteTrip, toggleSave, dismiss } = useStore();
  const trip = trips.find((t) => t.id === id);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toast = useToast();

  const [tab, setTab] = useState<'discover' | 'itinerary'>('discover');
  const [list, setList] = useState<Discovery[] | null>(null);
  const [aiSource, setAiSource] = useState<'ai' | 'map-data'>('map-data');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [routing, setRouting] = useState(false);
  const ctl = useRef<AbortController | null>(null);

  const load = useCallback(async (t: Trip) => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy(true); setErr(null);
    try {
      const q = { interests: t.interests, mode: t.transport, maxKm: t.maxDetourKm, dismissed: profile?.dismissed, affinity: profile?.affinity, limit: 30 };
      const raw = t.route && t.route.coords.length > 1
        ? await discoverAlongRoute(t.route.coords, q, ctl.current.signal)
        : await discoverNearby(t.origin, q, ctl.current.signal);
      const rich = await enrich(raw, 18);
      const res = await DiscoveryService.explain(rich, { interests: t.interests, style: t.style, tripTitle: t.title });
      setAiSource(res.source);
      setList([...res.list]);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErr('Could not load places right now. The public map servers may be busy — try again in a moment.');
    } finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.dismissed?.length]);

  useEffect(() => { if (trip && list === null) load(trip); return () => ctl.current?.abort(); }, [trip?.id]); // eslint-disable-line

  const shown = useMemo(() => (list ?? []).filter((d) => (!filter || d.category === filter) && !profile?.dismissed.includes(d.placeId)), [list, filter, profile?.dismissed]);
  const markers = useMemo(() => (trip ? tripMarkers(trip, tab === 'discover' ? shown : []) : []), [trip, shown, tab]);
  const sel = shown.find((d) => d.placeId === selected);

  if (!trip) {
    return <View style={{ flex: 1, paddingTop: insets.top + 40 }}><EmptyState icon="map-outline" title="Trip not found" body="It may have been deleted." action="Back to Discover" onAction={() => router.replace('/')} /></View>;
  }

  const activeStops = trip.stops.filter((s) => s.status !== 'skipped');
  const visitMin = activeStops.reduce((a, s) => a + (s.visitMin ?? 0), 0);
  const cats = categoriesFor(trip.interests).map((c) => c.key);
  const present = new Set((list ?? []).map((d) => d.category));

  async function onAdd(d: Discovery) {
    setRouting(true);
    try { await addStop(trip!, d); toast.show(`${d.name} added · route updated`); }
    finally { setRouting(false); }
  }

  async function startTrip() {
    await saveTrip({ ...trip!, status: 'active' });
    router.push({ pathname: '/explore', params: { trip: trip!.id } });
  }

  const mapH = Math.round(Math.min(height * 0.42, 380));

  return (
    <View style={{ flex: 1, backgroundColor: color.white }}>
      <MapView
        style={{ height: mapH + insets.top }}
        route={trip.route?.coords}
        routeStyle={trip.route?.source === 'straight-line' ? 'dashed' : 'solid'}
        markers={markers}
        selectedId={selected}
        fitKey={`${trip.id}:${trip.stops.length}:${trip.route?.coords.length ?? 0}`}
        center={[trip.origin.lng, trip.origin.lat]}
        zoom={10}
        onMarkerPress={(mid) => { if (shown.some((d) => d.placeId === mid)) { setSelected(mid); setTab('discover'); } }}
        onMapPress={() => setSelected(undefined)}
      />
      <View style={{ position: 'absolute', top: insets.top + space.md, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="arrow-back" label="Back" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton icon="refresh" label="Refresh discoveries" tone="glass" onPress={() => load(trip)} />
          <IconButton icon="trash-outline" label="Delete trip" tone="glass" onPress={() => confirm('Delete this trip?', 'Its stops, photos and replay will be removed. This cannot be undone.', 'Delete', async () => { await deleteTrip(trip.id); router.replace('/journeys'); })} />
        </View>
      </View>
      {routing ? (
        <Animated.View entering={FadeIn} style={{ position: 'absolute', top: insets.top + 70, alignSelf: 'center' }}>
          <Pill tone="ocean" icon="git-branch-outline" label="Recalculating route…" />
        </Animated.View>
      ) : null}

      {sel ? (
        <Animated.View entering={FadeInUp.springify().damping(18)} style={[{ position: 'absolute', top: mapH + insets.top - 110, left: space.lg, right: space.lg, flexDirection: 'row', backgroundColor: '#FFF', borderRadius: radius.lg, overflow: 'hidden', zIndex: 5 }, shadow.float]}>
          <Photo uri={sel.imageUrl} label={sel.name} style={{ width: 96, height: 96 }} />
          <View style={{ flex: 1, padding: space.md, gap: 4 }}>
            <T v="bodyStrong" numberOfLines={1}>{sel.name}</T>
            <T v="micro" c={color.inkSoft}>{sel.categoryLabel} · {fmtKm(sel.distanceKm)} off route · +{fmtMin(sel.detourMin)} est.</T>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 2 }}>
              <Button small label="Add" icon="add" onPress={() => { onAdd(sel); setSelected(undefined); }} />
              <Button small v="secondary" label="Close" onPress={() => setSelected(undefined)} />
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View style={{ flex: 1, marginTop: -24, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: color.white }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} stickyHeaderIndices={[1]}>
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xl, gap: 4 }}>
            <T v="kicker" c={color.teal}>{tripDateLabel(trip)} · {trip.transport}</T>
            <T v="h1">{trip.title}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: 4 }}>
              {trip.route ? <T v="small" c={color.inkSoft}>{fmtKm(trip.route.distanceM / 1000)} · {fmtMin(trip.route.durationS / 60)} on the road</T> : <T v="small" c={color.inkSoft}>Open-ended · exploring within {trip.maxDetourKm} km</T>}
              {activeStops.length ? <T v="small" c={color.inkSoft}>{activeStops.length} stops · ~{fmtMin(visitMin)} visiting (est.)</T> : null}
            </View>
            {trip.route?.source === 'straight-line' ? <Pill tone="warn" icon="warning-outline" label="Routing service unavailable — showing a straight line" style={{ marginTop: 6 }} /> : null}
          </View>

          <View style={{ backgroundColor: color.white, paddingHorizontal: space.xl, paddingVertical: space.md }}>
            <View style={{ flexDirection: 'row', backgroundColor: color.cream, borderRadius: radius.pill, padding: 4 }}>
              {(['discover', 'itinerary'] as const).map((k) => (
                <Press key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? color.ocean : 'transparent' }}>
                  <T v="label" c={tab === k ? color.white : color.charcoal}>{k === 'discover' ? `Discoveries${list ? ` · ${shown.length}` : ''}` : `Itinerary · ${activeStops.length}`}</T>
                </Press>
              ))}
            </View>
          </View>

          {tab === 'discover' ? (
            <View style={{ gap: space.lg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}>
                <Chip label="All" selected={!filter} onPress={() => setFilter(null)} />
                {CATEGORY.filter((c) => cats.includes(c.key) && present.has(c.key)).map((c) => (
                  <Chip key={c.key} label={c.label} icon={c.icon} selected={filter === c.key} onPress={() => setFilter(filter === c.key ? null : c.key)} />
                ))}
              </ScrollView>
              {list && !busy ? <View style={{ paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                <T v="micro" c={color.inkSoft}>Real places from OpenStreetMap and Wikipedia{trip.route ? ` within ${trip.maxDetourKm} km of your route` : ''}. Reasons:</T>
                <SourceTag source={aiSource} />
              </View> : null}
              {busy ? (
                <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
                  <T v="small" c={color.inkSoft}>Searching OpenStreetMap and Wikipedia along your route…</T>
                  {[0, 1, 2].map((i) => <Skeleton key={i} h={260} r={radius.lg} />)}
                </View>
              ) : err ? (
                <ErrorState message={err} onRetry={() => load(trip)} />
              ) : shown.length === 0 ? (
                <EmptyState icon="telescope-outline" title="Nothing mapped here yet" body="Try more interests or a wider detour distance. Remote routes have fewer mapped places." action="Widen to 40 km" onAction={async () => { const t = { ...trip, maxDetourKm: Math.max(40, trip.maxDetourKm) }; await saveTrip(t); load(t); }} />
              ) : (
                <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
                  {shown.map((d, i) => (
                    <DiscoveryCard key={d.placeId} d={d} index={i}
                      added={trip.stops.some((s) => s.placeId === d.placeId)}
                      saved={saved.some((s) => s.placeId === d.placeId)}
                      offRouteLabel={trip.route ? 'off route' : 'from start'}
                      onAdd={() => onAdd(d)}
                      onSave={async () => toast.show((await toggleSave({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category, imageUrl: d.imageUrl })) ? 'Saved for later' : 'Removed from saved')}
                      onDismiss={async () => { await dismiss(d); toast.show('Got it — fewer like this'); }}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Itinerary trip={trip}
              onMove={(sid, dir) => { setRouting(true); moveStop(trip, sid, dir).finally(() => setRouting(false)); }}
              onRemove={(sid) => { setRouting(true); removeStop(trip, sid).finally(() => setRouting(false)); }}
              onSkip={(sid, skipped) => setStopStatus(trip, sid, skipped ? 'planned' : 'skipped')}
              onDiscover={() => setTab('discover')}
            />
          )}
        </ScrollView>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: insets.bottom + space.lg, backgroundColor: 'rgba(248,247,243,0.97)', borderTopWidth: 1, borderTopColor: color.line, flexDirection: 'row', gap: space.sm }}>
        {trip.status === 'completed' ? (
          <Button style={{ flex: 1 }} label="View TravelReplay" icon="film" v="sand" onPress={() => router.push(`/replay/${trip.id}`)} />
        ) : trip.status === 'active' ? (
          <Button style={{ flex: 1 }} label="Continue in Explore" icon="navigate" onPress={() => router.push({ pathname: '/explore', params: { trip: trip.id } })} />
        ) : (
          <Button style={{ flex: 1 }} label="Start this trip" icon="navigate" onPress={startTrip} />
        )}
      </View>
      {toast.node}
    </View>
  );
}

function Itinerary({ trip, onMove, onRemove, onSkip, onDiscover }: { trip: Trip; onMove: (id: string, d: -1 | 1) => void; onRemove: (id: string) => void; onSkip: (id: string, skipped: boolean) => void; onDiscover: () => void }) {
  let n = 0;
  return (
    <View style={{ paddingHorizontal: space.xl, gap: 0 }}>
      <Row dot="A" dotColor={color.charcoal} title={trip.origin.name} sub={trip.origin.context ?? 'Start'} />
      {trip.stops.length === 0 ? (
        <View style={{ marginLeft: 15, borderLeftWidth: 2, borderLeftColor: color.cream, borderStyle: 'dashed', paddingLeft: space.xl, paddingVertical: space.lg, gap: space.sm }}>
          <T v="small" c={color.inkSoft}>No stops yet. Add discoveries to build your route.</T>
          <Button small v="secondary" icon="telescope-outline" label="Browse discoveries" onPress={onDiscover} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {trip.stops.map((s, i) => {
        const skipped = s.status === 'skipped';
        const num = skipped ? '–' : String(++n);
        return (
          <Animated.View key={s.id} layout={LinearTransition.springify().damping(20)}>
            <Row dot={num} dotColor={skipped ? color.gray : color.ocean} title={s.name} sub={`${s.category ? (categoryByKey[s.category]?.label ?? s.category) + ' · ' : ''}${s.visitMin ? `~${fmtMin(s.visitMin)} visit (est.)` : ''}${skipped ? ' · skipped' : s.status === 'visited' ? ' · visited' : ''}`} faded={skipped} img={s.imageUrl}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                <Small icon="chevron-up" label={`Move ${s.name} earlier`} onPress={() => onMove(s.id, -1)} disabled={i === 0} />
                <Small icon="chevron-down" label={`Move ${s.name} later`} onPress={() => onMove(s.id, 1)} disabled={i === trip.stops.length - 1} />
                <Small icon={skipped ? 'arrow-undo-outline' : 'play-skip-forward-outline'} label={skipped ? `Restore ${s.name}` : `Skip ${s.name}`} onPress={() => onSkip(s.id, skipped)} />
                <Small icon="trash-outline" label={`Remove ${s.name}`} onPress={() => confirm('Remove this stop?', s.name, 'Remove', () => onRemove(s.id))} />
              </View>
            </Row>
          </Animated.View>
        );
      })}
      {trip.destination ? <Row dot="B" dotColor={color.teal} title={trip.destination.name} sub={trip.destination.context ?? 'Destination'} last /> : null}
      {trip.route ? <T v="micro" c={color.gray} style={{ marginTop: space.lg }}>Route by {trip.route.source === 'osrm' ? 'OSRM (OpenStreetMap)' : trip.route.source === 'mapbox' ? 'Mapbox' : 'straight line (routing unavailable)'}. Visit times are estimates.</T> : null}
    </View>
  );
}

function Row({ dot, dotColor, title, sub, children, last, faded, img }: { dot: string; dotColor: string; title: string; sub?: string; children?: React.ReactNode; last?: boolean; faded?: boolean; img?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, opacity: faded ? 0.5 : 1 }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: dotColor, alignItems: 'center', justifyContent: 'center' }}><T v="label" c={color.white}>{dot}</T></View>
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: color.cream, minHeight: 24 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: space.lg, flexDirection: 'row', gap: space.md }}>
        {img ? <Photo uri={img} style={{ width: 52, height: 52, borderRadius: 12 }} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyStrong" numberOfLines={2}>{title}</T>
          {sub ? <T v="micro" c={color.inkSoft} numberOfLines={1}>{sub}</T> : null}
          {children}
        </View>
      </View>
    </View>
  );
}

function Small({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press onPress={disabled ? undefined : onPress} accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <Icon name={icon} size={18} color={color.teal} />
    </Press>
  );
}
