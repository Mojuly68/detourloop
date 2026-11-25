// TRAVELREPLAY — turns a trip into an interactive story: animated journey map, photo timeline,
// memory cards, a factual story, statistics, a video preview, and a share link.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Media, Replay, Trip } from '@/data/types';
import { useStore } from '@/state/store';
import { ReplayStoryService } from '@/services/ai';
import { distanceToLineKm, fmtKm, fmtMin } from '@/services/geo';
import { pickAndAdd } from '@/services/media';
import { hasEntitlement } from '@/services/subscriptions';
import { isCloud } from '@/services/config';
import { callFunction } from '@/services/supabase';
import { categoryByKey } from '@/services/places';
import { color, font, radius, shadow, space } from '@/theme/tokens';
import { Button, Chip, EmptyState, Icon, IconButton, Loading, Pill, Press, SectionHeader, SourceTag, T, useToast } from '@/components/ui/primitives';
import { Photo } from '@/components/ui/media';
import { Sheet } from '@/components/ui/Sheet';
import { confirm, notify } from '@/components/ui/confirm';
import MapView from '@/components/map/MapView';
import type { MapMarker } from '@/components/map/runtime';
import { ReplayPlayer, TEMPLATES, type Aspect, type Template } from '@/components/replay/ReplayPlayer';

export default function ReplayScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { trips, profile } = useStore();
  const trip = trips.find((t) => t.id === id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 480);
  const toast = useToast();

  const [media, setMedia] = useState<Media[] | null>(null);
  const [replay, setReplay] = useState<Replay | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sel, setSel] = useState<Media | null>(null);
  const [template, setTemplate] = useState<Template>('minimalist');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [preview, setPreview] = useState(false);
  const [render, setRender] = useState<{ status: string; note: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [m, r] = await Promise.all([repo.listMedia(id), repo.getReplay(id)]);
    setMedia(m); setReplay(r);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const visited = useMemo(() => trip?.stops.filter((s) => s.status !== 'skipped') ?? [], [trip]);

  // Where each stop / photo sits along the route (0-1), for the progressive reveal.
  const markers = useMemo<MapMarker[]>(() => {
    if (!trip) return [];
    const line = trip.route?.coords ?? [];
    const at = (p: { lat: number; lng: number }) => (line.length > 1 ? distanceToLineKm(p, line).index / (line.length - 1) : 0);
    const out: MapMarker[] = [{ id: 'origin', kind: 'origin', lat: trip.origin.lat, lng: trip.origin.lng, label: trip.origin.name, at: 0 }];
    visited.forEach((s, i) => out.push({ id: s.id, kind: 'stop', lat: s.lat, lng: s.lng, n: i + 1, label: s.name, at: at(s) }));
    if (trip.destination) out.push({ id: 'dest', kind: 'dest', lat: trip.destination.lat, lng: trip.destination.lng, label: trip.destination.name, at: 1 });
    (media ?? []).filter((m) => m.type === 'photo' && m.lat != null && m.lng != null && (replay?.selectedMediaIds.includes(m.id) ?? true)).slice(0, 12)
      .forEach((m) => out.push({ id: m.id, kind: 'media', lat: m.lat!, lng: m.lng!, img: m.uri, at: at({ lat: m.lat!, lng: m.lng! }) }));
    return out;
  }, [trip, visited, media, replay?.selectedMediaIds]);

  const currentPlace = useMemo(() => {
    const passed = markers.filter((m) => (m.kind === 'stop' || m.kind === 'origin' || m.kind === 'dest') && (m.at ?? 0) <= progress + 1e-6);
    return passed[passed.length - 1]?.label;
  }, [markers, progress]);

  function play() {
    if (raf.current) clearInterval(raf.current);
    setPlaying(true);
    let p = 0;
    setProgress(0);
    const total = Math.max(6000, Math.min(14000, (trip?.route?.coords.length ?? 100) * 12));
    raf.current = setInterval(() => {
      p += 50 / total;
      if (p >= 1) { p = 1; clearInterval(raf.current!); raf.current = null; setPlaying(false); }
      setProgress(p);
    }, 50);
  }
  useEffect(() => () => { if (raf.current) clearInterval(raf.current); }, []);

  if (!trip) return <View style={{ flex: 1, paddingTop: insets.top + 40 }}><EmptyState icon="film-outline" title="Replay not found" body="This trip may have been deleted." action="Back" onAction={() => router.replace('/replay')} /></View>;
  if (media === null || replay === undefined) return <View style={{ flex: 1, paddingTop: insets.top + 40 }}><Loading label="Gathering your journey" /></View>;

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');
  const days = trip.startDate && trip.endDate ? Math.round((+new Date(trip.endDate) - +new Date(trip.startDate)) / 86400000) + 1 : trip.days;
  const favStop = (() => {
    const c = new Map<string, number>();
    media.forEach((m) => m.stopId && c.set(m.stopId, (c.get(m.stopId) ?? 0) + (m.favorite ? 3 : 1)));
    const best = [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return trip.stops.find((s) => s.id === best)?.name;
  })();

  async function create() {
    setCreating(true);
    try {
      const story = await ReplayStoryService.write(trip!, media!);
      const favs = media!.filter((m) => m.favorite);
      const sel = (favs.length ? favs : media!).slice(0, 40).map((m) => m.id);
      const r: Replay = {
        tripId: trip!.id, title: story.title, narrative: story.story, narrativeSource: story.source,
        coverImage: (favs[0] ?? photos[0])?.uri ?? trip!.coverImage, selectedMediaIds: sel, visibility: 'private', status: 'ready', createdAt: new Date().toISOString(),
        stats: { distance_km: trip!.route ? Math.round(trip!.route.distanceM / 1000) : undefined, stops: visited.length, photos: photos.length, videos: videos.length, days },
      };
      await repo.saveReplay(r);
      setReplay(r);
      setTimeout(play, 600);
    } catch (e: any) {
      notify('Could not create the Replay', e?.message ?? 'Please try again.');
    } finally { setCreating(false); }
  }

  async function saveReplay(patch: Partial<Replay>) {
    const r = { ...replay!, ...patch };
    setReplay(r);
    try { await repo.saveReplay(r); } catch (e: any) { toast.show(e?.message ?? 'Could not save'); }
  }

  async function addMedia() {
    const r = await pickAndAdd(trip!, 'library');
    if (r.error) toast.show(r.error);
    if (r.added.length) {
      setMedia((m) => [...(m ?? []), ...r.added].sort((a, b) => (a.capturedAt ?? '').localeCompare(b.capturedAt ?? '')));
      if (replay) await saveReplay({ selectedMediaIds: [...replay.selectedMediaIds, ...r.added.map((x) => x.id)], coverImage: replay.coverImage ?? r.added[0].uri });
      toast.show(`${r.added.length} added${r.skipped ? ` · ${r.skipped} video skipped (needs cloud storage)` : ''}`);
    } else if (r.skipped) toast.show('Videos need cloud storage (Supabase) in the web demo');
  }

  async function updateMedia(m: Media) {
    setMedia((all) => (all ?? []).map((x) => (x.id === m.id ? m : x)).sort((a, b) => (a.capturedAt ?? '').localeCompare(b.capturedAt ?? '')));
    setSel(m);
    await repo.updateMedia(m);
  }

  async function requestRender() {
    if (!hasEntitlement(profile, 'premium_templates') && template !== 'minimalist') { router.push('/paywall'); return; }
    if (!isCloud) { setRender({ status: 'unavailable', note: 'Video files are rendered on a server (FFmpeg worker). This build has no backend connected, so no video was created. Use “Play preview” to watch it on this device.' }); return; }
    try {
      const r = await callFunction<{ job: { status: string; error?: string } }>('render-video', { replay_id: replay!.tripId, template, aspect });
      setRender(r.job.status === 'unavailable'
        ? { status: 'unavailable', note: 'The render service is not set up yet (RENDER_WORKER_URL). No video was created.' }
        : { status: 'queued', note: 'Queued. Rendering happens in the background; this page will show the video when it is actually ready.' });
    } catch {
      setRender({ status: 'failed', note: 'Could not reach the render service. No video was created.' });
    }
  }

  async function share(visibility: 'unlisted' | 'public') {
    setShareBusy(true);
    try {
      const url = await repo.share(trip!.id, visibility);
      if (!url) {
        notify('Sharing needs the cloud', 'Share links are served by the DetourLoop web app from your account. In demo mode everything stays on this device, so there is no link to share. You can still share a text summary.');
        return;
      }
      await saveReplay({ visibility, shareUrl: url });
      toast.show('Share link ready');
    } catch (e: any) {
      notify('Could not create a link', e?.message ?? 'Try again.');
    } finally { setShareBusy(false); }
  }

  // ── Intro: "Your adventure is ready to replay." ──────────────────────────────
  if (!replay) {
    const cover = photos[0]?.uri ?? trip.coverImage ?? visited.find((s) => s.imageUrl)?.imageUrl;
    return (
      <View style={{ flex: 1, backgroundColor: color.oceanDeep }}>
        <Animated.View entering={FadeIn.duration(1200)} style={StyleSheet.absoluteFill}><Photo uri={cover} label={trip.title} style={StyleSheet.absoluteFill} /></Animated.View>
        <LinearGradient colors={['rgba(12,24,32,0.3)', 'rgba(12,24,32,0.95)']} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: insets.top + space.md, left: space.lg }}><IconButton icon="arrow-back" label="Back" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/replay'))} /></View>
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: space.xl, paddingBottom: insets.bottom + space.xxxl, gap: space.lg }}>
          <Animated.View entering={FadeInUp.delay(300).springify().damping(16)}><T v="kicker" c={color.sand}>{trip.title}</T></Animated.View>
          <Animated.View entering={FadeInUp.delay(450).springify().damping(16)}><T v="hero" c={color.white}>Your adventure is ready to replay.</T></Animated.View>
          <Animated.View entering={FadeInUp.delay(600)}><T v="body" c="rgba(248,247,243,0.85)">We've brought your journey together. Relive the places, moments, and memories that made it special.</T></Animated.View>
          <Animated.View entering={FadeInUp.delay(700)} style={{ flexDirection: 'row', gap: space.lg }}>
            <Stat n={visited.length} l="stops" light /><Stat n={photos.length} l="photos" light /><Stat n={videos.length} l="videos" light />{trip.route ? <Stat n={Math.round(trip.route.distanceM / 1000)} l="km" light /> : null}
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(800)} style={{ gap: space.sm }}>
            <Button v="sand" icon="film" label="Create My Replay" loading={creating} onPress={create} />
            <Button v="light" icon="images-outline" label={photos.length ? 'Add more photos first' : 'Add photos first'} onPress={addMedia} />
          </Animated.View>
        </View>
        {toast.node}
      </View>
    );
  }

  // ── The Replay ───────────────────────────────────────────────────────────────
  const byDay = groupByDay(media);
  const fmtDay = (d: string) => (d === 'undated' ? 'Date unknown' : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  const shareText = `${replay.title}\n\n${replay.narrative}${replay.shareUrl ? `\n\n${replay.shareUrl}` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: color.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
        {/* Cover */}
        <View style={{ height: 460, backgroundColor: color.oceanDeep }}>
          <Photo uri={replay.coverImage} label={replay.title} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(12,24,32,0.35)', 'transparent', 'rgba(12,24,32,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', top: insets.top + space.md, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="arrow-back" label="Back" tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/replay'))} />
            <IconButton icon="share-outline" label="Share" tone="glass" onPress={() => Share.share({ message: shareText, title: replay.title }).catch(() => {})} />
          </View>
          <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: space.xxl, gap: space.sm }}>
            <T v="kicker" c={color.sand}>TravelReplay{trip.startDate ? ` · ${new Date(trip.startDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}</T>
            <T v="hero" c={color.white}>{replay.title}</T>
          </View>
        </View>

        {/* Animated journey map */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader kicker="The journey" title="Watch it unfold" />
          <View style={[{ marginHorizontal: space.xl, borderRadius: radius.lg, overflow: 'hidden' }, shadow.card]}>
            <MapView style={{ height: 340 }} route={trip.route?.coords} routeStyle={trip.route?.source === 'straight-line' ? 'dashed' : 'solid'} markers={markers} progress={progress} fitKey={`replay:${trip.id}`} center={[trip.origin.lng, trip.origin.lat]} />
            <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: 'rgba(248,247,243,0.95)', borderRadius: radius.pill, padding: 6, paddingRight: space.lg }}>
              <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause journey' : 'Play journey'} tone="dark" onPress={() => { if (playing) { if (raf.current) clearInterval(raf.current); setPlaying(false); } else play(); }} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" numberOfLines={1}>{currentPlace ?? trip.origin.name}</T>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: color.cream, marginTop: 4 }}><View style={{ height: 4, borderRadius: 2, width: `${progress * 100}%`, backgroundColor: color.teal }} /></View>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={{ marginTop: space.xxl, marginHorizontal: space.xl, padding: space.xl, borderRadius: radius.lg, backgroundColor: color.cream, gap: space.lg }}>
          <T v="kicker" c={color.teal}>By the numbers</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg }}>
            <Stat n={trip.route ? Math.round(trip.route.distanceM / 1000) : '—'} l={trip.route?.source === 'straight-line' ? 'km (straight line)' : 'km planned route'} />
            <Stat n={visited.length + 1 + (trip.destination ? 1 : 0)} l="destinations" />
            <Stat n={visited.length} l="stops" />
            <Stat n={days} l={days === 1 ? 'day' : 'days'} />
            <Stat n={photos.length} l="photos" />
            <Stat n={videos.length} l="videos" />
          </View>
          <T v="small" c={color.inkSoft}>Favourite destination: {favStop ?? 'mark photos as favourites to choose one'}. Highest elevation: not recorded (needs elevation data).</T>
        </View>

        {/* Story */}
        <View style={{ marginTop: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="kicker" c={color.teal}>Your story</T>
            <SourceTag source={replay.narrativeSource === 'ai' ? 'ai' : replay.narrativeSource === 'user' ? 'user' : 'template'} />
          </View>
          {editing ? (
            <>
              <TextInput value={draft} onChangeText={setDraft} multiline accessibilityLabel="Edit your story" style={{ minHeight: 220, borderRadius: radius.md, borderWidth: 1, borderColor: color.teal, padding: space.lg, fontFamily: font.body, fontSize: 17, lineHeight: 27, color: color.ink, backgroundColor: '#FFF', textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button style={{ flex: 1 }} label="Save story" icon="checkmark" onPress={async () => { await saveReplay({ narrative: draft, narrativeSource: 'user' }); setEditing(false); toast.show('Story saved'); }} />
                <Button v="secondary" label="Cancel" onPress={() => setEditing(false)} />
              </View>
            </>
          ) : (
            <>
              {replay.narrative.split('\n\n').map((p, i) => (
                <T key={i} v="body" style={i === 0 ? { fontFamily: 'Roboto_700Bold', fontSize: 22, lineHeight: 31 } : { fontSize: 17, lineHeight: 27 }}>{p}</T>
              ))}
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Button small v="secondary" icon="create-outline" label="Edit" onPress={() => { setDraft(replay.narrative); setEditing(true); }} />
                <Button small v="ghost" icon="refresh" label="Regenerate" onPress={() => confirm('Regenerate the story?', 'Your edits will be replaced.', 'Regenerate', async () => {
                  const s = await ReplayStoryService.write(trip, media); await saveReplay({ narrative: s.story, narrativeSource: s.source }); toast.show('Story regenerated');
                })} />
              </View>
            </>
          )}
        </View>

        {/* Memory cards */}
        {visited.length ? (
          <View style={{ marginTop: space.xxl }}>
            <SectionHeader kicker="Memory cards" title="Places that made it" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={w * 0.7 + space.md} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}>
              {visited.map((s, i) => {
                const m = media.find((x) => x.stopId === s.id && x.type === 'photo');
                const when = m?.capturedAt ?? (trip.startDate ? trip.startDate + 'T12:00:00' : undefined);
                return (
                  <Animated.View key={s.id} entering={FadeInDown.delay(i * 80)} style={[{ width: w * 0.7, borderRadius: radius.lg, backgroundColor: color.cream, overflow: 'hidden' }, shadow.card]}>
                    <Photo uri={m?.uri ?? s.imageUrl} label={s.name} credit={!m && s.imageUrl ? 'Wikimedia Commons' : undefined} style={{ height: 240 }} />
                    <View style={{ padding: space.lg, gap: 4 }}>
                      <T v="kicker" c={color.teal}>{String(i + 1).padStart(2, '0')} · {s.category ? categoryByKey[s.category]?.label ?? s.category : 'Stop'}</T>
                      <T v="h2" numberOfLines={2}>{s.name}</T>
                      {when ? <T v="micro" c={color.inkSoft}>{new Date(when).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{m?.capturedAt ? '' : ' (trip date)'} · {s.lat.toFixed(3)}, {s.lng.toFixed(3)}</T> : null}
                      {m?.caption ? <T v="small" c={color.charcoal}>“{m.caption}”</T> : s.description ? <T v="small" c={color.inkSoft} numberOfLines={3}>{s.description}</T> : null}
                    </View>
                  </Animated.View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Photo timeline */}
        <View style={{ marginTop: space.xxl }}>
          <SectionHeader kicker="Photo timeline" title="Day by day" action="Add" onAction={addMedia} />
          {media.length === 0 ? (
            <View style={{ marginHorizontal: space.xl }}><EmptyState icon="images-outline" title="No photos yet" body="Add photos and videos from this trip. We read their date and location (if your camera saved it) to place them on the timeline." action="Add photos" onAction={addMedia} /></View>
          ) : (
            <View style={{ paddingHorizontal: space.xl, gap: space.xl }}>
              {byDay.map(([day, items]) => (
                <View key={day} style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.teal }} />
                    <T v="h3">{fmtDay(day)}</T>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((m) => {
                      const stop = trip.stops.find((s) => s.id === m.stopId);
                      const inShare = replay.selectedMediaIds.includes(m.id);
                      return (
                        <Press key={m.id} onPress={() => setSel(m)} accessibilityLabel={`${m.type}${m.caption ? ', ' + m.caption : ''}${stop ? ', at ' + stop.name : ''}. Edit`} style={{ width: (w - space.xl * 2 - 12) / 3, aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden' }}>
                          {m.type === 'photo' ? <Photo uri={m.uri} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: color.ocean, alignItems: 'center', justifyContent: 'center' }]}><Icon name="videocam" size={26} color={color.sand} /></View>}
                          {m.favorite ? <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="heart" size={16} color="#FFF" /></View> : null}
                          {!inShare ? <View style={{ position: 'absolute', top: 6, left: 6 }}><Icon name="eye-off" size={14} color="#FFF" /></View> : null}
                          {stop ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 4, backgroundColor: 'rgba(15,42,56,0.6)' }}><T v="micro" c="#FFF" numberOfLines={1} style={{ fontSize: 10 }}>{stop.name}</T></View> : null}
                        </Press>
                      );
                    })}
                  </View>
                </View>
              ))}
              <T v="micro" c={color.gray}>Tap a photo to add a caption, fix its date or place, mark a favourite, or hide it from the shared story.</T>
            </View>
          )}
        </View>

        {/* Video */}
        <View style={{ marginTop: space.xxl, marginHorizontal: space.xl, padding: space.xl, borderRadius: radius.lg, backgroundColor: color.oceanDeep, gap: space.lg }}>
          <T v="kicker" c={color.sand}>Cinematic recap</T>
          <T v="h2" c={color.white}>Turn it into a film</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {TEMPLATES.map((t) => <Chip key={t.key} tone="dark" label={t.plus && !hasEntitlement(profile, 'premium_templates') ? `${t.label} · Plus` : t.label} selected={template === t.key} onPress={() => setTemplate(t.key)} />)}
          </ScrollView>
          <T v="small" c="rgba(248,247,243,0.75)">{TEMPLATES.find((t) => t.key === template)?.line}</T>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['16:9', '9:16', '1:1'] as Aspect[]).map((a) => <Chip key={a} tone="dark" icon={a === '16:9' ? 'tablet-landscape-outline' : a === '9:16' ? 'phone-portrait-outline' : 'square-outline'} label={a} selected={aspect === a} onPress={() => setAspect(a)} />)}
          </View>
          <Button v="sand" icon="play" label="Play preview" onPress={() => setPreview(true)} />
          <Button v="light" icon="cloud-upload-outline" label="Render video file" onPress={requestRender} />
          {render ? (
            <Animated.View entering={FadeIn} style={{ backgroundColor: 'rgba(248,247,243,0.1)', borderRadius: radius.md, padding: space.md, gap: 4 }}>
              <T v="label" c={color.sand}>{render.status === 'queued' ? 'Rendering queued' : render.status === 'failed' ? 'Render failed' : 'Rendering not available'}</T>
              <T v="small" c="rgba(248,247,243,0.85)">{render.note}</T>
            </Animated.View>
          ) : null}
        </View>

        {/* Share */}
        <View style={{ marginTop: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
          <T v="kicker" c={color.teal}>Share</T>
          <T v="h2">Who can see this story?</T>
          <View style={{ flexDirection: 'row', backgroundColor: color.cream, borderRadius: radius.pill, padding: 4 }}>
            {(['private', 'unlisted', 'public'] as const).map((v) => (
              <Press key={v} onPress={() => (v === 'private' ? (replay.shareUrl ? confirm('Make private?', 'The share link will stop working for everyone.', 'Make private', async () => { await repo.revokeShare(trip.id); await saveReplay({ visibility: 'private', shareUrl: undefined }); toast.show('Link revoked'); }) : saveReplay({ visibility: 'private' })) : share(v))}
                accessibilityRole="radio" accessibilityState={{ selected: replay.visibility === v }}
                style={{ flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: replay.visibility === v ? color.ocean : 'transparent' }}>
                <T v="label" c={replay.visibility === v ? color.white : color.charcoal}>{v[0].toUpperCase() + v.slice(1)}</T>
              </Press>
            ))}
          </View>
          <T v="small" c={color.inkSoft}>
            {replay.visibility === 'private' ? 'Only you can see it.' : replay.visibility === 'unlisted' ? 'Anyone with the link can see it. It is not listed anywhere.' : 'Anyone with the link can see it, and it may be featured.'}
            {' '}Shared stories show the title, story, route, stops and only the photos you have not hidden. Never notes, budget or email.
          </T>
          {shareBusy ? <Loading /> : null}
          {replay.shareUrl ? (
            <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, gap: space.sm }}>
              <T v="small" c={color.teal} numberOfLines={1}>{replay.shareUrl}</T>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button small icon="share-outline" label="Send link" onPress={() => Share.share({ message: replay.shareUrl!, url: replay.shareUrl }).catch(() => {})} />
                <Button small v="danger" label="Revoke" onPress={() => confirm('Revoke the link?', 'It will stop working for everyone.', 'Revoke', async () => { await repo.revokeShare(trip.id); await saveReplay({ visibility: 'private', shareUrl: undefined }); toast.show('Link revoked'); })} />
              </View>
            </View>
          ) : !isCloud ? (
            <Pill tone="warn" icon="information-circle-outline" label="Demo mode: share links need the cloud backend" />
          ) : null}
          <Button v="secondary" icon="chatbubble-ellipses-outline" label="Share as text" onPress={() => Share.share({ message: shareText }).catch(() => {})} />
        </View>
      </ScrollView>

      {/* Media editor */}
      <Sheet visible={!!sel} onClose={() => setSel(null)} label="Edit photo">
        {sel ? <MediaEditor m={sel} trip={trip} inShare={replay.selectedMediaIds.includes(sel.id)}
          onChange={updateMedia}
          onToggleShare={(on) => saveReplay({ selectedMediaIds: on ? [...replay.selectedMediaIds, sel.id] : replay.selectedMediaIds.filter((x) => x !== sel.id) })}
          onCover={() => { saveReplay({ coverImage: sel.uri }); toast.show('Cover updated'); }}
          onDelete={() => confirm('Delete this item?', 'It will be removed from the trip.', 'Delete', async () => { await repo.deleteMedia(sel); setMedia((all) => (all ?? []).filter((x) => x.id !== sel.id)); setSel(null); })} /> : null}
      </Sheet>
      <ReplayPlayer visible={preview} onClose={() => setPreview(false)} trip={trip} media={media.filter((m) => replay.selectedMediaIds.includes(m.id))} template={template} aspect={aspect} title={replay.title} />
      {toast.node}
    </View>
  );
}

function MediaEditor({ m, trip, inShare, onChange, onToggleShare, onCover, onDelete }: { m: Media; trip: Trip; inShare: boolean; onChange: (m: Media) => void; onToggleShare: (on: boolean) => void; onCover: () => void; onDelete: () => void }) {
  const [caption, setCaption] = useState(m.caption ?? '');
  const [date, setDate] = useState(m.capturedAt ? toLocalInput(m.capturedAt) : '');
  const [dateErr, setDateErr] = useState(false);
  useEffect(() => { setCaption(m.caption ?? ''); setDate(m.capturedAt ? toLocalInput(m.capturedAt) : ''); }, [m.id]); // eslint-disable-line
  return (
    <>
      {m.type === 'photo' ? <Photo uri={m.uri} contentFit="contain" style={{ height: 260, borderRadius: radius.md, backgroundColor: '#111' }} /> : <View style={{ height: 120, borderRadius: radius.md, backgroundColor: color.ocean, alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={36} color={color.sand} /></View>}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button small v={m.favorite ? 'sand' : 'secondary'} icon={m.favorite ? 'heart' : 'heart-outline'} label={m.favorite ? 'Favourite' : 'Mark favourite'} onPress={() => onChange({ ...m, favorite: !m.favorite })} />
        <Button small v={inShare ? 'secondary' : 'sand'} icon={inShare ? 'eye-outline' : 'eye-off-outline'} label={inShare ? 'In shared story' : 'Hidden from share'} onPress={() => onToggleShare(!inShare)} />
        {m.type === 'photo' ? <Button small v="ghost" icon="image-outline" label="Use as cover" onPress={onCover} /> : null}
      </View>
      <TextInput value={caption} onChangeText={setCaption} onBlur={() => caption !== (m.caption ?? '') && onChange({ ...m, caption: caption.trim() || undefined })} placeholder="Add a caption" placeholderTextColor={color.gray} accessibilityLabel="Caption"
        style={{ minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.lg, fontFamily: font.medium, fontSize: 16, color: color.ink, backgroundColor: '#FFF' }} />
      <View style={{ gap: 6 }}>
        <T v="label" c={color.inkSoft}>Date and time (YYYY-MM-DD HH:MM)</T>
        <TextInput value={date} onChangeText={(v) => { setDate(v); setDateErr(false); }} placeholder="2026-11-25 16:30" placeholderTextColor={color.gray} accessibilityLabel="Date and time"
          onBlur={() => { if (!date) return; const d = fromLocalInput(date); if (!d) { setDateErr(true); return; } onChange({ ...m, capturedAt: d }); }}
          style={{ minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: dateErr ? color.danger : color.line, paddingHorizontal: space.lg, fontFamily: font.medium, fontSize: 16, color: color.ink, backgroundColor: '#FFF' }} />
        {dateErr ? <T v="micro" c={color.danger}>Use the format 2026-11-25 16:30</T> : null}
      </View>
      <View style={{ gap: 6 }}>
        <T v="label" c={color.inkSoft}>Place</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="None" selected={!m.stopId} onPress={() => onChange({ ...m, stopId: undefined })} />
          {trip.stops.filter((s) => s.status !== 'skipped').map((s) => <Chip key={s.id} label={s.name} selected={m.stopId === s.id} onPress={() => onChange({ ...m, stopId: s.id, lat: m.lat ?? s.lat, lng: m.lng ?? s.lng })} />)}
        </View>
        <T v="micro" c={color.gray}>{m.lat != null ? `Location ${m.lat.toFixed(4)}, ${m.lng!.toFixed(4)}${m.stopId ? '' : ''}` : 'No location saved with this file. Pick a place to put it on the map.'}</T>
      </View>
      <Button v="danger" icon="trash-outline" label="Delete from trip" onPress={onDelete} />
    </>
  );
}

function Stat({ n, l, light }: { n: number | string; l: string; light?: boolean }) {
  return (
    <View style={{ width: light ? undefined : '33%', gap: 0 }}>
      <T v="h1" c={light ? color.white : color.ocean} style={{ fontSize: 32, lineHeight: 36 }}>{typeof n === 'number' ? n.toLocaleString() : n}</T>
      <T v="micro" c={light ? 'rgba(248,247,243,0.75)' : color.inkSoft}>{l}</T>
    </View>
  );
}

function groupByDay(media: Media[]): [string, Media[]][] {
  const g = new Map<string, Media[]>();
  for (const m of media) {
    const k = m.capturedAt ? toLocalInput(m.capturedAt).slice(0, 10) : 'undated';
    g.set(k, [...(g.get(k) ?? []), m]);
  }
  return [...g.entries()].sort(([a], [b]) => (a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)));
}

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(iso: string) { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocalInput(s: string) { const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0)); return isNaN(+d) ? null : d.toISOString(); }
