// DISCOVER — home. Cinematic hero, search, and editorial sections built from real places.
import React, { useState } from 'react';
import { Linking, ScrollView, View, useWindowDimensions , StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Discovery } from '@/data/types';
import { useStore } from '@/state/store';
import { EXPERIENCES, HERO, INSPIRATION, ROAD_TRIPS, UNEXPECTED } from '@/content/editorial';
import { discoverNearby, enrich } from '@/services/places';
import { useLocation } from '@/services/location';
import { sizedThumb, type WikiSummary } from '@/services/photos';
import { fmtKm } from '@/services/geo';
import { color, radius, shadow, space } from '@/theme/tokens';
import { Button, ErrorState, IconButton, IconTile, Pill, Press, SectionHeader, Skeleton, T, useToast } from '@/components/ui/primitives';
import { Photo, WikiCard, useWiki } from '@/components/ui/media';
import { PlaceSearch } from '@/components/ui/PlaceSearch';
import { Sheet } from '@/components/ui/Sheet';
import { ModeBanner } from '@/components/ui/ModeBanner';
import { TripCard } from '@/components/ui/TripCard';

const QUICK: { icon: string; label: string; interests: string[] }[] = [
  { icon: 'sunny-outline', label: 'Beaches', interests: ['beaches', 'surfing'] },
  { icon: 'triangle-outline', label: 'Mountains', interests: ['hiking', 'scenic', 'adventure'] },
  { icon: 'water-outline', label: 'Waterfalls', interests: ['nature', 'hiking'] },
  { icon: 'business-outline', label: 'Small towns', interests: ['historic', 'local', 'food'] },
  { icon: 'bonfire-outline', label: 'Camping', interests: ['camping', 'nature'] },
  { icon: 'restaurant-outline', label: 'Local food', interests: ['food', 'local'] },
];

export default function Discover() {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 480);
  const insets = useSafeAreaInsets();
  const { profile, trips, toggleSave, saved } = useStore();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const heroH = 430;
  const HERO_SKY_EXTRA = 60;
  const parallax = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [-200, 0, heroH], [-60, 0, heroH * 0.45]) }, { scale: interpolate(scrollY.value, [-200, 0], [1.25, 1], 'clamp') }],
  }));
  // White band behind the status bar once the hero has scrolled away.
  const statusScrim = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [heroH - 140, heroH - 60], [0, 1], 'clamp') }));

  const { loc, request } = useLocation();
  const [near, setNear] = useState<Discovery[] | null>(null);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [sheet, setSheet] = useState<WikiSummary | null>(null);
  const toast = useToast();

  async function loadNear(p?: { lat: number; lng: number } | null) {
    const at = p ?? (await request());
    if (!at) return;
    setNearBusy(true); setNearErr(null);
    try {
      const list = await discoverNearby(at, { interests: profile?.prefs.interests ?? [], mode: 'driving', maxKm: 30, dismissed: profile?.dismissed, affinity: profile?.affinity, limit: 14 });
      setNear(await enrich(list, 14));
    } catch {
      setNearErr('Could not reach OpenStreetMap right now.');
    } finally { setNearBusy(false); }
  }

  const upcoming = trips.filter((t) => t.status !== 'completed').slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* HERO */}
        {/* The photo sits low; above it the sky continues in its own color, so the headline has
            a long, calm band of open sky to sit on. */}
        <View style={{ height: heroH, overflow: 'hidden', backgroundColor: HERO.sky }}>
          <Animated.View style={[{ position: 'absolute', top: HERO_SKY_EXTRA, left: 0, right: 0, height: heroH - HERO_SKY_EXTRA + 40 }, parallax]}>
            <Image source={HERO.source} accessibilityLabel={HERO.label} contentFit="cover" contentPosition="center" style={{ flex: 1, backgroundColor: HERO.sky }} />
            <LinearGradient colors={[HERO.sky, `${HERO.sky}00`]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }} />
          </Animated.View>
          {/* Light wash behind the status bar and logo only; deeper at the bottom for the buttons. */}
          <LinearGradient colors={['rgba(46,26,14,0.32)', 'rgba(46,26,14,0)', 'rgba(46,26,14,0)', 'rgba(20,12,8,0.45)']} locations={[0, 0.22, 0.6, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', top: insets.top + space.md, left: space.xl, right: space.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>{/* keeps the logo on the right when there is no demo banner */}<ModeBanner compact dark /></View>
            <Image source={require('../../../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 9 }} accessibilityLabel="DetourLoop" />
          </View>
          <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: 40, flexDirection: 'row', gap: space.sm }}>
            <Button label="Plan a trip" icon="sparkles" onPress={() => router.push('/plan')} style={{ flex: 1 }} />
            <Button label="Nearby" icon="locate" v="light" onPress={() => router.push({ pathname: '/explore', params: { nearby: '1' } })} style={{ flex: 1 }} />
          </View>
        </View>

        {/* Content panel slides over the photo, like a sheet. */}
        <View style={{ marginTop: -16, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: color.paper, paddingTop: space.xl }}>

        {/* SEARCH */}
        <View style={[{ marginHorizontal: space.xl, borderRadius: radius.pill, zIndex: 20 }, shadow.card]}>
          <PlaceSearch placeholder="Where do you want to go?" onPick={(p) => router.push({ pathname: '/plan', params: { to: p.name, toLat: String(p.lat), toLng: String(p.lng) } })} />
        </View>

        {/* QUICK INTERESTS — outline icon tiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm, paddingTop: space.xl }}>
          {QUICK.map((q) => (
            <IconTile key={q.label} icon={q.icon} label={q.label} onPress={() => router.push({ pathname: '/plan', params: { interests: q.interests.join(',') } })} />
          ))}
        </ScrollView>

        {/* CONTINUE */}
        {upcoming.length ? (
          <Section>
            <SectionHeader kicker="Continue your journey" title="Your trips" action="All" onAction={() => router.push('/journeys')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: 4, paddingBottom: space.xl }}>
              {upcoming.map((t) => <TripCard key={t.id} trip={t} width={w * 0.72} height={200} onPress={() => router.push(`/trip/${t.id}`)} />)}
            </ScrollView>
          </Section>
        ) : null}

        {/* EXPERIENCES */}
        <Section>
          <SectionHeader kicker="Explore by experience" title="What are you in the mood for?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={w * 0.42 + space.md} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: 4, paddingBottom: space.xl }}>
            {EXPERIENCES.map((e) => (
              <WikiCard key={e.key} inset wiki={e.wiki} title={e.title} line={e.wiki.split(',')[0]} width={w * 0.42} height={200}
                onPress={() => router.push({ pathname: '/plan', params: { interests: e.interests.join(',') } })} />
            ))}
          </ScrollView>
        </Section>

        {/* NEAR YOU */}
        <Section>
          <SectionHeader kicker="Near you" title="Worth a short detour" />
          {near === null && !nearBusy ? (
            <View style={{ marginHorizontal: space.xl, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.tile, gap: space.sm }}>
              <T v="bodyStrong">See real places around you</T>
              <T v="small" c={color.inkSoft}>We ask for your location once, only to search nearby. It is not stored or tracked.</T>
              {loc.status === 'denied' ? (
                <View style={{ gap: space.sm }}>
                  <T v="small" c={color.danger}>Location is off. Search for a town instead:</T>
                  <PlaceSearch placeholder="Town or area" onPick={(p) => loadNear(p)} />
                </View>
              ) : (
                <Button label="Use my location" icon="locate" onPress={() => loadNear()} loading={loc.status === 'asking'} />
              )}
            </View>
          ) : nearBusy ? (
            <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: 4, paddingBottom: space.xl }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} w={220} h={200} r={radius.lg} />)}
            </ScrollView>
          ) : nearErr ? (
            <ErrorState message={nearErr} onRetry={() => loadNear(loc.status === 'ok' ? { lat: loc.lat!, lng: loc.lng! } : undefined)} />
          ) : near && near.length === 0 ? (
            <T v="small" c={color.inkSoft} style={{ marginHorizontal: space.xl }}>No mapped places matched your interests within 30 km.</T>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: 4, paddingBottom: space.xl }}>
              {near!.map((d) => (
                <Press key={d.placeId} onPress={() => router.push({ pathname: '/plan', params: { to: d.name, toLat: String(d.lat), toLng: String(d.lng) } })} accessibilityLabel={`Plan a trip to ${d.name}, ${fmtKm(d.distanceKm)} away`}
                  style={{ width: 200 }}>
                  <Photo uri={d.imageUrl} label={d.name} style={{ height: 130, borderRadius: radius.md }} />
                  <View style={{ paddingTop: 8, gap: 3 }}>
                    <Pill label={d.categoryLabel} />
                    <T v="bodyStrong" numberOfLines={1}>{d.name}</T>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T v="micro" c={color.inkSoft}>{fmtKm(d.distanceKm)} away</T>
                      <Press onPress={async () => toast.show((await toggleSave({ placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category, imageUrl: d.imageUrl })) ? 'Saved for later' : 'Removed')} accessibilityLabel={`Save ${d.name}`} style={{ padding: 6 }}>
                        <T v="label" c={color.teal}>{saved.some((s) => s.placeId === d.placeId) ? 'Saved' : 'Save'}</T>
                      </Press>
                    </View>
                  </View>
                </Press>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* UNEXPECTED */}
        <Section>
          <SectionHeader kicker="Unexpected discoveries" title="Places most people drive past" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: 4, paddingBottom: space.xl }}>
            {UNEXPECTED.map((u) => (
              <WikiCard key={u} inset wiki={u} title={u.replace(/ \(.*\)$/, '')} line="Tap for the story" width={w * 0.5} height={210} onPress={(s) => s && setSheet(s)} />
            ))}
          </ScrollView>
        </Section>

        {/* ROAD TRIPS */}
        <Section>
          <SectionHeader kicker="Popular road trips" title="Classic routes, your way" />
          <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
            {ROAD_TRIPS.map((r) => (
              <RoadTripRow key={r.title} r={r} />
            ))}
          </View>
        </Section>

        {/* INSPIRATION */}
        <Section>
          <SectionHeader kicker="Travel inspiration" title="Some day" />
          <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
            {INSPIRATION.map((i) => (
              <WikiCard key={i.wiki} wiki={i.wiki} kicker={i.kicker} line={i.line} width="100%" height={240} big onPress={(s) => s && setSheet(s)} />
            ))}
          </View>
        </Section>

        <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
          <T v="micro" c={color.gray}>Photos and descriptions: Wikipedia and Wikimedia Commons (CC BY-SA). Places: © OpenStreetMap contributors. Weather: Open-Meteo.</T>
        </View>
        </View>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color.paper }, statusScrim]} />

      <Sheet visible={!!sheet} onClose={() => setSheet(null)} label={sheet?.title}>
        {sheet ? (
          <>
            <Photo uri={sizedThumb(sheet.thumb, 1000) ?? sheet.image} label={sheet.title} style={{ height: 220, borderRadius: radius.md }} />
            <T v="h1">{sheet.title}</T>
            {sheet.extract ? <T v="body" c={color.inkSoft}>{sheet.extract}</T> : null}
            <Pill icon="book-outline" label="From Wikipedia" />
            <Button label="Plan a trip here" icon="sparkles" onPress={() => {
              const s = sheet; setSheet(null);
              router.push({ pathname: '/plan', params: { to: s.title, ...(s.lat != null ? { toLat: String(s.lat), toLng: String(s.lng) } : {}) } });
            }} />
            {sheet.lat != null ? (
              <Button v="secondary" icon="bookmark-outline" label="Save for later" onPress={async () => {
                await toggleSave({ placeId: `wiki:${sheet.title}`, name: sheet.title, lat: sheet.lat!, lng: sheet.lng!, imageUrl: sheet.thumb });
                toast.show('Saved for later'); setSheet(null);
              }} />
            ) : null}
            <Button v="ghost" icon="open-outline" label="Read on Wikipedia" onPress={() => Linking.openURL(sheet.url)} />
          </>
        ) : null}
      </Sheet>
      {toast.node}
    </View>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={{ marginTop: space.xxl }}>{children}</View>;
}

function RoadTripRow({ r }: { r: (typeof ROAD_TRIPS)[number] }) {
  const s = useWiki(r.wiki);
  return (
    <Press onPress={() => router.push({ pathname: '/plan', params: { from: r.from, to: r.to, interests: r.interests.join(','), title: r.title } })} accessibilityLabel={`${r.title}, ${r.from} to ${r.to}`}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: 4 }}>
      <Photo uri={s ? sizedThumb(s.thumb, 300) : undefined} label={r.title} style={{ width: 76, height: 76, borderRadius: radius.md }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyStrong">{r.title}</T>
        <T v="micro" c={color.teal}>{r.from.split(',')[0]} → {r.to.split(',')[0]}</T>
        <T v="small" c={color.inkSoft} numberOfLines={1}>{r.blurb}</T>
      </View>
    </Press>
  );
}
