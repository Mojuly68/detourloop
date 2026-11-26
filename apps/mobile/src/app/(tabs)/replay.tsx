// REPLAY tab — every completed trip as a story, newest first.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Replay } from '@/data/types';
import { useStore } from '@/state/store';
import { color, radius, space } from '@/theme/tokens';
import { Button, EmptyState, Pill, Press, T } from '@/components/ui/primitives';
import { Photo } from '@/components/ui/media';
import { tripDateLabel } from '@/components/ui/TripCard';

export default function ReplayTab() {
  const insets = useSafeAreaInsets();
  const { trips } = useStore();
  const done = trips.filter((t) => t.status === 'completed');
  const active = trips.find((t) => t.status === 'active');
  const [replays, setReplays] = useState<Record<string, Replay | null>>({});

  useEffect(() => {
    Promise.all(done.map(async (t) => [t.id, await repo.getReplay(t.id)] as const)).then((pairs) => setReplays(Object.fromEntries(pairs)));
  }, [done.length]); // eslint-disable-line

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: 40, gap: space.xl }}>
      <View style={{ paddingHorizontal: space.xl, gap: 6 }}>
        <T v="kicker" c={color.teal}>TravelReplay</T>
        <T v="h1">Every journey deserves a story.</T>
      </View>
      {done.length === 0 ? (
        <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
          <EmptyState icon="film-outline" title="Your first Replay is one trip away" body="When you end a trip, DetourLoop gathers your route, stops, photos and notes into an animated story you can relive and share." />
          {active ? <Button icon="navigate" label={`Continue “${active.title}”`} onPress={() => router.push({ pathname: '/explore', params: { trip: active.id } })} /> : <Button icon="sparkles" label="Plan an adventure" onPress={() => router.push('/plan')} />}
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.xl, gap: space.lg }}>
          {done.map((t, i) => {
            const r = replays[t.id];
            return (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 70)}>
                <Press onPress={() => router.push(`/replay/${t.id}`)} accessibilityLabel={`${r ? 'Open replay' : 'Create replay'} for ${t.title}`} style={{ height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.ocean }}>
                  <Photo uri={r?.coverImage ?? t.coverImage} label={t.title} icon="film-outline" style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['transparent', 'rgba(12,24,32,0.9)']} style={StyleSheet.absoluteFill} />
                  <View style={{ position: 'absolute', top: space.md, left: space.md }}>
                    <Pill tone={r ? 'sand' : 'glass'} icon={r ? 'film' : 'sparkles'} label={r ? (r.visibility === 'private' ? 'Replay · private' : `Replay · ${r.visibility}`) : 'Ready to replay'} />
                  </View>
                  <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, gap: 4 }}>
                    <T v="h1" c={color.white} numberOfLines={2}>{r?.title ?? t.title}</T>
                    <T v="small" c="rgba(248,247,243,0.85)">{tripDateLabel(t)} · {t.stops.filter((s) => s.status !== 'skipped').length} stops</T>
                  </View>
                </Press>
              </Animated.View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
