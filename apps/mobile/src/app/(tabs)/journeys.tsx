// MY JOURNEYS — the travel library: upcoming, traveling, completed and saved places.
import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/state/store';
import { color, font, radius, space } from '@/theme/tokens';
import { Button, EmptyState, Icon, IconButton, Press, T, useToast } from '@/components/ui/primitives';
import { Photo } from '@/components/ui/media';
import { TripCard } from '@/components/ui/TripCard';
import { confirm } from '@/components/ui/confirm';
import { categoryByKey } from '@/services/places';

type Tab = 'upcoming' | 'active' | 'completed' | 'saved';
const TABS: { k: Tab; label: string }[] = [
  { k: 'upcoming', label: 'Upcoming' }, { k: 'active', label: 'Traveling' }, { k: 'completed', label: 'Completed' }, { k: 'saved', label: 'Saved' },
];

export default function Journeys() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 480);
  const { trips, saved, deleteTrip, toggleSave } = useStore();
  const [tab, setTab] = useState<Tab>(trips.some((t) => t.status === 'active') ? 'active' : 'upcoming');
  const [q, setQ] = useState('');
  const toast = useToast();

  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const list = useMemo(() => trips.filter((t) => (tab === 'upcoming' ? t.status === 'planned' : tab === 'active' ? t.status === 'active' : t.status === 'completed'))
    .filter((t) => !q || match(t.title) || match(t.origin.name) || (t.destination && match(t.destination.name)) || t.stops.some((s) => match(s.name))), [trips, tab, q]); // eslint-disable-line
  const places = saved.filter((p) => !q || match(p.name));
  const count = (k: Tab) => (k === 'saved' ? saved.length : trips.filter((t) => (k === 'upcoming' ? t.status === 'planned' : k === 'active' ? t.status === 'active' : t.status === 'completed')).length);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: 140, gap: space.lg }} stickyHeaderIndices={[1]}>
        <View style={{ paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View><T v="kicker" c={color.teal}>My journeys</T><T v="h1">Your travel library</T></View>
          <IconButton icon="add" label="Plan a new trip" tone="dark" onPress={() => router.push('/plan')} />
        </View>
        <View style={{ backgroundColor: color.white, paddingHorizontal: space.xl, paddingVertical: space.sm, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.lg, backgroundColor: '#FFF' }}>
            <Icon name="search" size={18} color={color.teal} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search trips, places, stops" placeholderTextColor={color.gray} accessibilityLabel="Search your journeys" style={{ flex: 1, minHeight: 46, fontFamily: font.medium, fontSize: 16, color: color.ink }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {TABS.map((t) => (
              <Press key={t.k} onPress={() => setTab(t.k)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.k }}
                style={{ minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: tab === t.k ? color.ocean : color.cream }}>
                <T v="label" c={tab === t.k ? color.white : color.charcoal}>{t.label} · {count(t.k)}</T>
              </Press>
            ))}
          </ScrollView>
        </View>

        {tab === 'saved' ? (
          places.length === 0 ? (
            <EmptyState icon="bookmark-outline" title={q ? 'No saved places match' : 'Nothing saved yet'} body="Tap Save on any discovery to keep it here for a future trip." />
          ) : (
            <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
              {places.map((p) => (
                <Animated.View key={p.placeId} layout={LinearTransition} entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#FFF', borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.sm }}>
                  <Photo uri={p.imageUrl} label={p.name} style={{ width: 72, height: 72, borderRadius: radius.md }} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
                    <T v="micro" c={color.inkSoft}>{p.category ? categoryByKey[p.category]?.label ?? p.category : 'Place'} · saved {new Date(p.savedAt).toLocaleDateString()}</T>
                    <Press onPress={() => router.push({ pathname: '/plan', params: { to: p.name, toLat: String(p.lat), toLng: String(p.lng) } })} accessibilityLabel={`Plan a trip to ${p.name}`} style={{ marginTop: 4, minHeight: 32, justifyContent: 'center' }}>
                      <T v="label" c={color.teal}>Plan a trip here →</T>
                    </Press>
                  </View>
                  <Press onPress={async () => { await toggleSave(p); toast.show('Removed'); }} accessibilityLabel={`Remove ${p.name} from saved`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="bookmark" size={20} color={color.teal} />
                  </Press>
                </Animated.View>
              ))}
            </View>
          )
        ) : list.length === 0 ? (
          q ? <EmptyState icon="search" title="No trips match" body={`Nothing in ${TABS.find((t) => t.k === tab)!.label.toLowerCase()} matches “${q}”.`} />
            : trips.length === 0 ? (
              <View style={{ paddingHorizontal: space.xl }}>
                <View style={{ borderRadius: radius.xl, backgroundColor: color.ocean, padding: space.xxl, gap: space.lg, overflow: 'hidden' }}>
                  <Icon name="compass" size={44} color={color.sand} />
                  <T v="h1" c={color.white}>The best parts of a trip are the places you didn't plan.</T>
                  <T v="body" c="rgba(248,247,243,0.8)">Create your first adventure and DetourLoop will find what's worth stopping for along the way.</T>
                  <Button v="sand" icon="sparkles" label="Plan my first adventure" onPress={() => router.push('/plan')} />
                </View>
              </View>
            ) : (
              <EmptyState icon={tab === 'active' ? 'navigate-outline' : tab === 'completed' ? 'film-outline' : 'calendar-outline'} title={tab === 'active' ? 'Not traveling right now' : tab === 'completed' ? 'No completed trips yet' : 'No upcoming trips'}
                body={tab === 'active' ? 'Open an upcoming trip and tap “Start this trip”.' : tab === 'completed' ? 'End a trip from Explore to turn it into a Replay.' : 'Plan something new.'} action={tab === 'upcoming' ? 'Plan an adventure' : undefined} onAction={() => router.push('/plan')} />
            )
        ) : (
          <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
            {list.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 60)} layout={LinearTransition} style={{ gap: space.sm }}>
                <TripCard trip={t} width="100%" height={w * 0.56} onPress={() => router.push(t.status === 'completed' ? `/replay/${t.id}` : `/trip/${t.id}`)} />
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <Button small v="secondary" icon="map-outline" label={t.status === 'completed' ? 'Route & stops' : 'Edit itinerary'} onPress={() => router.push(`/trip/${t.id}`)} />
                  {t.status === 'completed' ? <Button small v="sand" icon="film-outline" label="Replay" onPress={() => router.push(`/replay/${t.id}`)} /> : null}
                  {t.status === 'active' ? <Button small icon="navigate" label="Explore" onPress={() => router.push({ pathname: '/explore', params: { trip: t.id } })} /> : null}
                  <Button small v="ghost" icon="trash-outline" label="Delete" onPress={() => confirm('Delete this trip?', `“${t.title}” with its stops, photos and replay. This cannot be undone.`, 'Delete', async () => { await deleteTrip(t.id); toast.show('Trip deleted'); })} />
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
      {toast.node}
    </View>
  );
}
