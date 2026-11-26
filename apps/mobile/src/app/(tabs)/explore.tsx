// EXPLORE — the live travel companion: active trip on the map, what's next, nearby detours,
// the DetourLoop Guide, notes and captures. Location is one-shot unless the user turns on live updates.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uid } from '@/data/repo';
import type { Discovery, Trip } from '@/data/types';
import { useStore } from '@/state/store';
import { useLocation } from '@/services/location';
import { discoverNearby, enrich, categoriesForQuestion } from '@/services/places';
import { DiscoveryService, TravelAssistantService } from '@/services/ai';
import { getWeather, type Weather } from '@/services/weather';
import { distanceToLineKm, fmtKm, fmtMin, haversineKm } from '@/services/geo';
import { navigationLinks } from '@/services/routing';
import { pickAndAdd } from '@/services/media';
import { color, font, radius, shadow, space } from '@/theme/tokens';
import { Button, Chip, EmptyState, ErrorState, Icon, IconButton, Pill, Press, SourceTag, T, useToast } from '@/components/ui/primitives';
import { DiscoveryCard } from '@/components/ui/DiscoveryCard';
import { PlaceSearch } from '@/components/ui/PlaceSearch';
import { Sheet } from '@/components/ui/Sheet';
import { Photo } from '@/components/ui/media';
import { confirm } from '@/components/ui/confirm';
import MapView from '@/components/map/MapView';
import { tripMarkers } from '@/components/map/markers';

const QUESTIONS = ["What's interesting around me?", 'Where can I watch the sunset?', 'Find a beautiful beach nearby', 'Where should I stop for lunch?', 'Find a campground for tonight', 'Is there a scenic detour ahead?'];

type Msg = { id: string; role: 'me' | 'guide'; text: string; places?: Discovery[]; source?: 'ai' | 'map-data' };

export default function Explore() {
  const params = useLocalSearchParams<{ trip?: string; nearby?: string }>();
  const { trips, profile, saveTrip, addStop, setStopStatus, dismiss, toggleSave, saved } = useStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const { loc, request, setManual } = useLocation();
  const here = loc.status === 'ok' ? { lat: loc.lat!, lng: loc.lng! } : null;

  const active = trips.find((t) => t.id === params.trip) ?? trips.find((t) => t.status === 'active');
  const [live, setLive] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [nearby, setNearby] = useState<Discovery[] | null>(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'nearby' | 'guide' | 'note' | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  // Weather for wherever we are (or the trip start).
  const wxAt = here ?? (active ? active.origin : null);
  useEffect(() => {
    if (!wxAt) return;
    getWeather(wxAt.lat, wxAt.lng).then(setWeather).catch(() => setWeather(null));
  }, [wxAt?.lat, wxAt?.lng]); // eslint-disable-line

  // "Explore Nearby" from the home screen: ask for location straight away (the user tapped for it).
  useEffect(() => { if (params.nearby === '1' && loc.status === 'idle') request(); }, [params.nearby]); // eslint-disable-line

  // Live updates: opt-in only, foreground only, stopped when the screen unmounts or the toggle is off.
  useEffect(() => {
    if (!live) { watch.current?.remove(); watch.current = null; return; }
    let dead = false;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted' || dead) { setLive(false); return; }
      watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 200, timeInterval: 30000 }, (pos) => setManual({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    })();
    return () => { dead = true; watch.current?.remove(); watch.current = null; };
  }, [live, setManual]);

  const progress = useMemo(() => {
    if (!active) return null;
    const stops = active.stops.filter((s) => s.status !== 'skipped');
    const visited = stops.filter((s) => s.status === 'visited').length;
    const next = stops.find((s) => s.status === 'planned');
    let remainingMin: number | undefined;
    if (active.route && here) {
      const { index, km } = distanceToLineKm(here, active.route.coords);
      if (km < 30) remainingMin = (active.route.durationS / 60) * (1 - index / Math.max(1, active.route.coords.length - 1));
    } else if (active.route) remainingMin = (active.route.durationS / 60) * (1 - visited / Math.max(1, stops.length + 1));
    return { stops, visited, next, remainingMin };
  }, [active, here]);

  async function findNearby() {
    let at = here;
    if (!at) at = await request();
    if (!at) { setManualOpen(true); return; }
    setSheet('nearby'); setNearBusy(true); setNearErr(null);
    try {
      const interests = active?.interests ?? profile?.prefs.interests ?? [];
      const maxKm = Math.min(active?.maxDetourKm ?? profile?.prefs.maxDetourKm ?? 20, 30);
      const list = await discoverNearby(at, { interests, mode: active?.transport ?? 'driving', maxKm, dismissed: profile?.dismissed, affinity: profile?.affinity, limit: 12 });
      const rich = await enrich(list, 12);
      const res = await DiscoveryService.explain(rich, { interests, style: active?.style ?? profile?.prefs.style ?? 'spontaneous' });
      setNearby(res.list.filter((d) => !active?.stops.some((s) => s.placeId === d.placeId)));
    } catch { setNearErr('Could not reach the map servers. Try again in a moment.'); }
    finally { setNearBusy(false); }
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question) return;
    setQ('');
    setMsgs((m) => [...m, { id: uid(), role: 'me', text: question }]);
    let at = here ?? (await request());
    let basis = '';
    if (!at && active) { at = active.origin; basis = `I don't have your location, so I looked around your trip's start, ${active.origin.name}. `; }
    if (!at) { setMsgs((m) => [...m, { id: uid(), role: 'guide', text: 'I need to know where you are. Share your location once, or set it by searching for a place.' }]); setManualOpen(true); return; }
    setThinking(true);
    try {
      const cats = categoriesForQuestion(question);
      const list = await discoverNearby(at, { interests: active?.interests ?? profile?.prefs.interests ?? [], categories: cats, mode: active?.transport ?? 'driving', maxKm: 25, dismissed: profile?.dismissed, affinity: profile?.affinity, limit: 15 });
      const rich = await enrich(list, 10);
      const res = await TravelAssistantService.ask(question, rich);
      let answer = basis + res.answer;
      if (/sunset/i.test(question) && weather?.sunset) answer += ` Sunset today is around ${weather.sunset} local time (Open-Meteo).`;
      setMsgs((m) => [...m, { id: uid(), role: 'guide', text: answer, places: res.places, source: res.source }]);
    } catch {
      setMsgs((m) => [...m, { id: uid(), role: 'guide', text: 'The map servers did not answer. Please try again in a moment.', source: 'map-data' }]);
    } finally { setThinking(false); }
  }

  async function accept(d: Discovery) {
    if (!active) { await toggleSave({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category, imageUrl: d.imageUrl }); toast.show('Saved for later'); return; }
    await addStop(active, d);
    setNearby((n) => n?.filter((x) => x.placeId !== d.placeId) ?? null);
    toast.show(`${d.name} added · route updated`);
  }

  async function capture(from: 'library' | 'camera') {
    if (!active) return;
    const r = await pickAndAdd(active, from, here ?? undefined);
    if (r.error) toast.show(r.error);
    else if (r.added.length) toast.show(`${r.added.length} added to your Replay${r.skipped ? ` · ${r.skipped} video skipped in browser demo` : ''}`);
    else if (r.skipped) toast.show('Videos need cloud storage (Supabase) in the web demo');
  }

  async function addNote() {
    if (!active || !note.trim()) return;
    await saveTrip({ ...active, notes: [...active.notes, { id: uid(), text: note.trim(), at: new Date().toISOString(), lat: here?.lat, lng: here?.lng }] });
    setNote(''); setSheet(null); toast.show('Note saved');
  }

  function endTrip() {
    if (!active) return;
    confirm('End this trip?', 'We will gather your route, stops, photos and notes into a TravelReplay.', 'End trip', async () => {
      await saveTrip({ ...active, status: 'completed', completedAt: new Date().toISOString(), stops: active.stops.map((s) => (s.status === 'planned' ? { ...s, status: 'visited' } : s)) });
      router.push({ pathname: '/replay/[id]', params: { id: active.id, fresh: '1' } });
    });
  }

  const markers = useMemo(() => (active ? tripMarkers(active, sheet === 'nearby' ? nearby ?? [] : [], here) : here ? [{ id: 'me', kind: 'me' as const, lat: here.lat, lng: here.lng }, ...(nearby ?? []).map((d) => ({ id: d.placeId, kind: 'discovery' as const, lat: d.lat, lng: d.lng, icon: '•', label: d.name }))] : []), [active, nearby, here, sheet]);
  const mapH = Math.round(height * (active ? 0.48 : 0.6));

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <MapView style={active ? { height: mapH } : { flex: 1 }} route={active?.route?.coords} routeStyle={active?.route?.source === 'straight-line' ? 'dashed' : 'solid'} markers={markers}
        fitKey={`${active?.id ?? 'none'}:${active?.stops.length ?? 0}:${here ? 'h' : ''}`} center={here ? [here.lng, here.lat] : active ? [active.origin.lng, active.origin.lat] : undefined} zoom={here && !active ? 11 : 6} />
      <View style={{ position: 'absolute', top: insets.top + space.md, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 6 }}>
          {weather ? <Pill tone="glass" icon={weather.icon} label={`${weather.tempC}° · ${weather.label}${weather.sunset ? ` · sunset ${weather.sunset}` : ''}`} /> : null}
          {here ? <Pill tone="glass" icon={live ? 'radio' : 'locate'} label={live ? 'Live location on' : 'Location: one-time fix'} /> : null}
        </View>
        <IconButton icon="locate" label="Show my location once" tone="glass" onPress={() => request().then((p) => !p && setManualOpen(true))} />
      </View>

      <ScrollView style={active ? { flex: 1, backgroundColor: color.paper } : { flexGrow: 0, backgroundColor: color.paper }} contentContainerStyle={{ padding: space.lg, paddingBottom: active ? 32 : space.lg, gap: space.md }}>
        {loc.status === 'denied' || manualOpen ? (
          <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.tile }}>
            <T v="small" c={color.ink}>{loc.status === 'denied' ? 'Location permission is off.' : 'Set your location manually.'} Search for where you are:</T>
            <PlaceSearch placeholder="Town, landmark or address" onPick={(p) => { setManual(p); setManualOpen(false); }} />
          </View>
        ) : null}
        {active ? (
          <>
            <View style={{ gap: 4 }}>
              <T v="kicker" c={color.teal}>Traveling now</T>
              <Press onPress={() => router.push(`/trip/${active.id}`)} accessibilityLabel={`Open ${active.title}`}><T v="h1">{active.title}</T></Press>
            </View>
            {progress ? (
              <View style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="small" c={color.inkSoft}>{progress.visited} of {progress.stops.length} stops visited</T>
                  {progress.remainingMin != null ? <T v="small" c={color.inkSoft}>ETA {new Date(Date.now() + progress.remainingMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (est.)</T> : null}
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: color.cream, overflow: 'hidden' }}>
                  <Animated.View style={{ height: 8, width: `${progress.stops.length ? (progress.visited / progress.stops.length) * 100 : 0}%`, backgroundColor: color.teal, borderRadius: 4 }} />
                </View>
              </View>
            ) : null}

            <View style={[{ backgroundColor: color.ocean, borderRadius: radius.lg, padding: space.lg, gap: space.md }, shadow.card]}>
              <T v="kicker" c={color.sand}>Signature move</T>
              <T v="h2" c={color.white}>Find something interesting nearby</T>
              <T v="small" c="rgba(248,247,243,0.8)">Real places around you that fit this trip. Accept one and the route updates.</T>
              <Button v="sand" icon="sparkles" label="Show me a detour" onPress={findNearby} loading={nearBusy && sheet !== 'nearby'} />
            </View>

            {progress?.next ? (
              <Animated.View entering={FadeInDown} style={{ borderRadius: radius.lg, backgroundColor: '#FFF', borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row' }}>
                  <Photo uri={progress.next.imageUrl} label={progress.next.name} style={{ width: 110, minHeight: 110 }} />
                  <View style={{ flex: 1, padding: space.md, gap: 4 }}>
                    <T v="kicker" c={color.teal}>Up next</T>
                    <T v="bodyStrong" numberOfLines={2}>{progress.next.name}</T>
                    {here ? <T v="micro" c={color.inkSoft}>{fmtKm(haversineKm(here, progress.next))} away (straight line)</T> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, paddingTop: 0, flexWrap: 'wrap' }}>
                  <Button small icon="navigate" label={Platform.OS === 'android' ? 'Google Maps' : 'Apple Maps'} onPress={() => Linking.openURL(Platform.OS === 'android' ? navigationLinks(progress.next!).google : navigationLinks(progress.next!).apple)} />
                  {Platform.OS !== 'android' ? <Button small v="secondary" label="Google Maps" onPress={() => Linking.openURL(navigationLinks(progress.next!).google)} /> : null}
                  <Button small v="secondary" icon="checkmark" label="Visited" onPress={() => setStopStatus(active, progress.next!.id, 'visited')} />
                  <Button small v="ghost" label="Skip" onPress={() => setStopStatus(active, progress.next!.id, 'skipped')} />
                </View>
              </Animated.View>
            ) : (
              <T v="small" c={color.inkSoft}>No more planned stops. Find a detour, or end the trip when you arrive.</T>
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Tile icon="chatbubbles-outline" label="Ask your Guide" onPress={() => setSheet('guide')} />
              <Tile icon="camera-outline" label={Platform.OS === 'web' ? 'Add photos' : 'Capture'} onPress={() => capture(Platform.OS === 'web' ? 'library' : 'camera')} />
              <Tile icon="images-outline" label="From library" onPress={() => capture('library')} />
              <Tile icon="create-outline" label="Trip note" onPress={() => setSheet('note')} />
            </View>

            <Press onPress={() => setLive((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: live }} accessibilityLabel="Live location updates while this screen is open"
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.cream }}>
              <Icon name="radio-outline" size={20} color={color.teal} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">Live location updates</T>
                <T v="micro" c={color.inkSoft}>Off by default. Only while this screen is open; never in the background; not stored.</T>
              </View>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: live ? color.teal : '#CFC6B5', padding: 3, alignItems: live ? 'flex-end' : 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' }} />
              </View>
            </Press>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.line }}>
              <Icon name="car-outline" size={18} color={color.inkSoft} />
              <T v="micro" c={color.inkSoft} style={{ flex: 1 }}>Driving? Let a passenger use DetourLoop, or check suggestions when you are stopped.</T>
            </View>

            <Button v="danger" icon="flag-outline" label="End trip and create Replay" onPress={endTrip} />
          </>
        ) : (
          <>
            <View style={{ gap: 2 }}>
              <T v="bodyStrong">No trip in progress</T>
              <T v="small" c={color.inkSoft}>Start a planned trip for live stops and detours, or look around where you are.</T>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button small icon="sparkles" label="Nearby" onPress={findNearby} style={{ flex: 1 }} />
              <Button small v="secondary" icon="chatbubbles-outline" label="Ask the Guide" onPress={() => setSheet('guide')} style={{ flex: 1 }} />
            </View>
            {trips.some((t) => t.status === 'planned') ? <Button v="ghost" label="Start a planned trip" onPress={() => router.push('/journeys')} /> : null}
          </>
        )}
      </ScrollView>

      {/* Nearby detours */}
      <Sheet visible={sheet === 'nearby'} onClose={() => setSheet(null)} label="Nearby discoveries">
        <T v="h2">Worth a detour</T>
        {nearBusy ? <T v="small" c={color.inkSoft}>Looking around you…</T> : nearErr ? <ErrorState message={nearErr} onRetry={findNearby} /> : nearby?.length === 0 ? (
          <T v="body" c={color.inkSoft}>Nothing mapped nearby matches this trip. Try again further along.</T>
        ) : (
          (nearby ?? []).map((d, i) => (
            <DiscoveryCard key={d.placeId} d={d} index={i} offRouteLabel="away" saved={saved.some((s) => s.placeId === d.placeId)}
              onAdd={() => accept(d)} onDismiss={async () => { await dismiss(d); setNearby((n) => n?.filter((x) => x.placeId !== d.placeId) ?? null); }}
              onSave={async () => toast.show((await toggleSave({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category, imageUrl: d.imageUrl })) ? 'Saved' : 'Removed')} />
          ))
        )}
      </Sheet>

      {/* The Guide */}
      <Sheet visible={sheet === 'guide'} onClose={() => setSheet(null)} label="Your DetourLoop Guide" maxHeight={0.92}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.ocean, alignItems: 'center', justifyContent: 'center' }}><Icon name="compass" size={22} color={color.sand} /></View>
          <View style={{ flex: 1 }}>
            <T v="h3">Your DetourLoop Guide</T>
            <T v="micro" c={color.inkSoft}>Answers from real places near you{here ? '' : ' (share or set your location first)'}</T>
          </View>
        </View>
        {msgs.length === 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {QUESTIONS.map((x) => <Chip key={x} label={x} onPress={() => ask(x)} />)}
          </View>
        ) : null}
        {msgs.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.springify().damping(18)} style={{ alignSelf: m.role === 'me' ? 'flex-end' : 'stretch', maxWidth: m.role === 'me' ? '85%' : '100%', gap: space.sm }}>
            <View style={{ backgroundColor: m.role === 'me' ? color.ocean : color.cream, borderRadius: radius.lg, padding: space.md }}>
              <T v="body" c={m.role === 'me' ? color.white : color.charcoal}>{m.text}</T>
            </View>
            {m.source ? <SourceTag source={m.source} /> : null}
            {m.places?.map((d, i) => (
              <DiscoveryCard key={d.placeId} d={d} index={i} compact offRouteLabel="away" saved={saved.some((s) => s.placeId === d.placeId)} added={active?.stops.some((s) => s.placeId === d.placeId)}
                onAdd={() => accept(d)} onSave={async () => toast.show((await toggleSave({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category, imageUrl: d.imageUrl })) ? 'Saved' : 'Removed')} />
            ))}
          </Animated.View>
        ))}
        {thinking ? <T v="small" c={color.inkSoft}>Looking at the map around you…</T> : null}
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Ask about places near you" placeholderTextColor={color.gray} onSubmitEditing={() => ask(q)} returnKeyType="send" accessibilityLabel="Ask your Guide"
            style={{ flex: 1, minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.lg, fontFamily: font.medium, fontSize: 16, color: color.ink, backgroundColor: '#FFF' }} />
          <IconButton icon="arrow-up" label="Send" tone="dark" onPress={() => ask(q)} />
        </View>
      </Sheet>

      {/* Notes */}
      <Sheet visible={sheet === 'note'} onClose={() => setSheet(null)} label="Trip note">
        <T v="h2">A note for your Replay</T>
        <TextInput value={note} onChangeText={setNote} multiline placeholder="What happened here? What do you want to remember?" placeholderTextColor={color.gray} accessibilityLabel="Trip note"
          style={{ minHeight: 140, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, padding: space.lg, fontFamily: font.body, fontSize: 16, color: color.ink, backgroundColor: '#FFF', textAlignVertical: 'top' }} />
        <Button label="Save note" icon="checkmark" onPress={addNote} disabled={!note.trim()} />
        {active?.notes.length ? <T v="micro" c={color.inkSoft}>{active.notes.length} note{active.notes.length === 1 ? '' : 's'} on this trip so far.</T> : null}
      </Sheet>
      {toast.node}
    </View>
  );
}

function Tile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ width: '48%', minHeight: 84, borderRadius: radius.lg, backgroundColor: '#FFF', borderWidth: 1, borderColor: color.line, padding: space.md, gap: 6, justifyContent: 'center' }}>
      <Icon name={icon} size={22} color={color.teal} />
      <T v="label">{label}</T>
    </Press>
  );
}
