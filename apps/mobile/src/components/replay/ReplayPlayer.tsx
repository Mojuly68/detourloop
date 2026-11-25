// In-app cinematic preview of a TravelReplay: title card, photo sequence with slow push-in
// (Ken Burns), place titles and dates, closing card. It renders on the device from real trip data.
// It is a PREVIEW, not an exported video file — the export goes through the render service.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming, cancelAnimation } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import type { Media, Stop, Trip } from '@/data/types';
import { imageSource } from '@/services/http';
import { color, space } from '@/theme/tokens';
import { IconButton, T } from '@/components/ui/primitives';

export type Template = 'cinematic' | 'adventure' | 'minimalist' | 'documentary' | 'social';
export type Aspect = '16:9' | '9:16' | '1:1';

export const TEMPLATES: { key: Template; label: string; line: string; plus: boolean }[] = [
  { key: 'minimalist', label: 'Minimalist', line: 'Clean type, white space', plus: false },
  { key: 'cinematic', label: 'Cinematic', line: 'Letterbox, slow push-ins', plus: true },
  { key: 'adventure', label: 'Adventure', line: 'Bold, fast, energetic', plus: true },
  { key: 'documentary', label: 'Documentary', line: 'Dates, places, captions', plus: true },
  { key: 'social', label: 'Social Media', line: 'Punchy, made for stories', plus: true },
];

const STYLE: Record<Template, { bg: string; title: string; sub: string; seconds: number; letterbox: boolean; serif: boolean; upper: boolean }> = {
  cinematic: { bg: '#05090C', title: color.white, sub: color.sand, seconds: 3.6, letterbox: true, serif: true, upper: false },
  adventure: { bg: color.charcoal, title: color.sand, sub: color.white, seconds: 2.2, letterbox: false, serif: false, upper: true },
  minimalist: { bg: color.white, title: color.ink, sub: color.inkSoft, seconds: 3, letterbox: false, serif: true, upper: false },
  documentary: { bg: color.oceanDeep, title: color.white, sub: color.sand, seconds: 4, letterbox: false, serif: true, upper: false },
  social: { bg: color.ocean, title: color.white, sub: color.sand, seconds: 1.8, letterbox: false, serif: false, upper: true },
};

type Slide = { kind: 'title' | 'photo' | 'end'; uri?: string; title: string; sub?: string };

export function ReplayPlayer({ visible, onClose, trip, media, template, aspect, title }: { visible: boolean; onClose: () => void; trip: Trip; media: Media[]; template: Template; aspect: Aspect; title: string }) {
  const { width, height } = useWindowDimensions();
  const st = STYLE[template];
  const slides = useMemo<Slide[]>(() => {
    const byStop = new Map<string, Stop>(trip.stops.map((s) => [s.id, s]));
    const photos = media.filter((m) => m.type === 'photo');
    const fmt = (s?: string) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : undefined);
    return [
      { kind: 'title', title, sub: [trip.startDate && fmt(trip.startDate + 'T12:00:00'), trip.route ? `${Math.round(trip.route.distanceM / 1000)} km` : undefined].filter(Boolean).join(' · ') },
      ...photos.map((m) => ({ kind: 'photo' as const, uri: m.uri, title: m.caption || (m.stopId && byStop.get(m.stopId)?.name) || trip.destination?.name || trip.title, sub: fmt(m.capturedAt) })),
      ...(photos.length === 0 ? trip.stops.filter((s) => s.status !== 'skipped').map((s) => ({ kind: 'photo' as const, uri: s.imageUrl, title: s.name, sub: s.imageUrl ? 'Photo: Wikimedia Commons' : undefined })) : []),
      { kind: 'end', title: 'Every journey deserves a story.', sub: 'DetourLoop · TravelReplay' },
    ];
  }, [trip, media, title]);

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const zoom = useSharedValue(1);

  useEffect(() => { if (visible) { setI(0); setPlaying(true); } }, [visible]);
  useEffect(() => {
    if (!visible || !playing) return;
    zoom.value = 1;
    zoom.value = withTiming(1.12, { duration: st.seconds * 1000 + 600, easing: Easing.linear });
    const t = setTimeout(() => setI((k) => (k + 1 < slides.length ? k + 1 : k)), st.seconds * 1000);
    if (i === slides.length - 1) setPlaying(false);
    return () => { clearTimeout(t); cancelAnimation(zoom); };
  }, [i, visible, playing, slides.length, st.seconds, zoom]);

  const kb = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const [aw, ah] = aspect === '16:9' ? [16, 9] : aspect === '9:16' ? [9, 16] : [1, 1];
  const maxW = Math.min(width, 480) - 24, maxH = height - 200;
  const fw = Math.min(maxW, (maxH * aw) / ah), fh = (fw * ah) / aw;
  const s = slides[i];
  const titleStyle = { fontFamily: st.serif ? 'Roboto_700Bold' : 'Roboto_700Bold', textTransform: st.upper ? 'uppercase' : 'none', fontSize: Math.max(18, fw / 13), lineHeight: Math.max(22, fw / 11), color: st.title } as const;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#05090C', alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <View style={{ position: 'absolute', top: 48, right: 16, zIndex: 3 }}><IconButton icon="close" label="Close preview" tone="glass" onPress={onClose} /></View>
        <Pressable onPress={() => setPlaying((p) => !p)} accessibilityLabel={playing ? 'Pause' : 'Play'} style={{ width: fw, height: fh, backgroundColor: st.bg, overflow: 'hidden', borderRadius: 6 }}>
          <Animated.View key={i} entering={FadeIn.duration(500)} exiting={FadeOut.duration(400)} style={StyleSheet.absoluteFill}>
            {s.kind === 'photo' && s.uri ? (
              <Animated.View style={[StyleSheet.absoluteFill, kb]}>
                <Image source={imageSource(s.uri)} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Animated.View>
            ) : null}
            {s.kind === 'photo' ? <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={[StyleSheet.absoluteFill, { top: '45%' }]} /> : null}
            <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: s.kind === 'photo' ? space.xl + (st.letterbox ? fh * 0.1 : 0) : undefined, top: s.kind === 'photo' ? undefined : 0, height: s.kind === 'photo' ? undefined : fh, justifyContent: 'center', alignItems: template === 'minimalist' || s.kind !== 'photo' ? 'center' : 'flex-start', gap: 6 }}>
              <T v="body" style={[titleStyle, { color: s.kind === 'photo' ? color.white : st.title, textAlign: s.kind === 'photo' && template !== 'minimalist' ? 'left' : 'center' }]}>{s.title}</T>
              {s.sub ? <T v="small" c={s.kind === 'photo' ? color.sand : st.sub} style={{ textAlign: 'center' }}>{s.sub}</T> : null}
            </View>
          </Animated.View>
          {st.letterbox ? (<><View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: fh * 0.09, backgroundColor: '#000' }} /><View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: fh * 0.09, backgroundColor: '#000' }} /></>) : null}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 4, width: fw }}>
          {slides.map((_, k) => <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: k <= i ? color.sand : 'rgba(255,255,255,0.2)' }} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <IconButton icon="play-skip-back" label="Previous" tone="glass" onPress={() => setI((k) => Math.max(0, k - 1))} />
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} tone="glass" onPress={() => { if (i === slides.length - 1) setI(0); setPlaying((p) => !p || i === slides.length - 1); }} />
          <IconButton icon="play-skip-forward" label="Next" tone="glass" onPress={() => setI((k) => Math.min(slides.length - 1, k + 1))} />
        </View>
        <T v="micro" c="rgba(248,247,243,0.6)" style={{ textAlign: 'center', paddingHorizontal: space.xl }}>Live preview on this device · {aspect} · no music (add your own when exporting)</T>
      </View>
    </Modal>
  );
}
