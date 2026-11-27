// Editorial trip card used on Discover and My Journeys.
import React from 'react';
import { View , StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Trip } from '@/data/types';
import { roundDistance, unitLabel } from '@/services/units';
import { color, radius, space } from '@/theme/tokens';
import { Pill, Press, T } from './primitives';
import { Photo } from './media';

const STATUS: Record<Trip['status'], { label: string; icon: string }> = {
  planned: { label: 'Upcoming', icon: 'calendar-outline' },
  active: { label: 'Traveling now', icon: 'navigate' },
  completed: { label: 'Completed', icon: 'checkmark-done' },
};

export function tripDateLabel(t: Trip) {
  if (!t.startDate) return `${t.days} day${t.days === 1 ? '' : 's'}`;
  const f = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return t.endDate && t.endDate !== t.startDate ? `${f(t.startDate)} – ${f(t.endDate)}` : f(t.startDate);
}

export function TripCard({ trip, width, height, onPress }: { trip: Trip; width: number | `${number}%`; height: number; onPress: () => void }) {
  const st = STATUS[trip.status];
  const stops = trip.stops.filter((s) => s.status !== 'skipped').length;
  return (
    <Press onPress={onPress} accessibilityLabel={`${trip.title}, ${st.label}, ${stops} stops`} style={{ width, height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.ocean }}>
      <Photo uri={trip.coverImage ?? trip.stops.find((s) => s.imageUrl)?.imageUrl} label={trip.destination?.name ?? trip.title} icon="map-outline" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(12,24,32,0.1)', 'rgba(12,24,32,0.85)']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: space.md, left: space.md }}>
        <Pill tone={trip.status === 'active' ? 'sand' : 'glass'} icon={st.icon} label={st.label} />
      </View>
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, gap: 2 }}>
        <T v="h2" c={color.white} numberOfLines={2} style={{ fontSize: 24, lineHeight: 27 }}>{trip.title}</T>
        <T v="micro" c="rgba(248,247,243,0.85)">{tripDateLabel(trip)} · {stops} stop{stops === 1 ? '' : 's'}{trip.route ? ` · ${roundDistance(trip.route.distanceM / 1000).toLocaleString()} ${unitLabel()}` : ''}</T>
      </View>
    </Press>
  );
}
