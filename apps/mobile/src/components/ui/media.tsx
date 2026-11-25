// Photography components. Real images only (Wikipedia/Commons or the user's own).
// When none exists, a designed typographic placeholder — never an unrelated stock photo.
import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle , StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { color, radius, shadow, space } from '@/theme/tokens';
import { sizedThumb, smallerThumb, wikiSummary, type WikiSummary } from '@/services/photos';
import { Icon, Press, Skeleton, T } from './primitives';

export function useWiki(ref?: string) {
  const [s, setS] = useState<WikiSummary | null | undefined>(ref ? undefined : null);
  useEffect(() => {
    let live = true;
    if (!ref) { setS(null); return; }
    wikiSummary(ref).then((r) => live && setS(r));
    return () => { live = false; };
  }, [ref]);
  return s; // undefined = loading, null = none
}

export function Placeholder({ label, icon = 'image-outline', style }: { label?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={[color.teal, color.ocean]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={icon} size={30} color="rgba(233,228,217,0.55)" />
      {label ? <T v="micro" c="rgba(233,228,217,0.7)" style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: space.md }} numberOfLines={2}>{label}</T> : null}
    </LinearGradient>
  );
}

export function Photo({ uri, style, label, icon, credit, contentFit = 'cover' }: { uri?: string | null; style?: StyleProp<ViewStyle>; label?: string; icon?: string; credit?: string; contentFit?: 'cover' | 'contain' }) {
  const [src, setSrc] = useState(uri);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSrc(uri); setFailed(false); }, [uri]);
  if (!src || failed) return <Placeholder label={label} icon={icon} style={style} />;
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: color.ocean }, style]}>
      <Image source={{ uri: src }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit={contentFit} transition={350}
        onError={() => { const s = smallerThumb(src); if (s && s !== src) setSrc(s); else setFailed(true); }} accessibilityLabel={label} />
      {credit ? (
        <View style={{ position: 'absolute', right: 8, bottom: 6, backgroundColor: 'rgba(15,42,56,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <T v="micro" c="rgba(248,247,243,0.85)" style={{ fontSize: 9 }}>{credit}</T>
        </View>
      ) : null}
    </View>
  );
}

/** Editorial photo card with gradient and overlaid title. Image from a Wikipedia title. */
export function WikiCard({ wiki, title, kicker, line, width, height, onPress, big, inset }: { wiki: string; title?: string; kicker?: string; line?: string; width: number | `${number}%`; height: number; onPress?: (s: WikiSummary | null) => void; big?: boolean; inset?: boolean }) {
  const s = useWiki(wiki);
  const img = s ? sizedThumb(s.thumb, big ? 1200 : 700) ?? s.image : undefined;
  if (inset) {
    // White card, photo inset with its own rounded corners, text underneath.
    const ph = Math.round(height * 0.62);
    return (
      <Press onPress={() => onPress?.(s ?? null)} accessibilityLabel={title ?? wiki} style={[{ width, height, borderRadius: radius.lg, backgroundColor: color.card, padding: 10 }, shadow.card]}>
        <View style={{ height: ph, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.tile }}>
          {s === undefined ? <Skeleton w="100%" h={ph} r={0} /> : <Photo uri={img} label={title ?? wiki} style={StyleSheet.absoluteFill} />}
        </View>
        <View style={{ paddingHorizontal: 6, paddingTop: 12, gap: 4 }}>
          <T v="bodyStrong" numberOfLines={1} style={{ fontFamily: 'Roboto_500Medium', fontSize: 16 }}>{title ?? s?.title ?? wiki}</T>
          <View style={{ width: 56, height: 1.5, backgroundColor: color.sand, borderRadius: 1 }} />
          {kicker || line ? <T v="micro" c={color.inkSoft} numberOfLines={2}>{line ?? kicker}</T> : null}
          {s?.thumb ? <T v="micro" c={color.gray} style={{ fontSize: 9 }}>Photo: Wikimedia Commons</T> : null}
        </View>
      </Press>
    );
  }
  return (
    <Press onPress={() => onPress?.(s ?? null)} accessibilityLabel={title ?? wiki} style={{ width, height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.ocean }}>
      {s === undefined ? <Skeleton w="100%" h={height} r={0} /> : <Photo uri={img} label={title ?? wiki} style={StyleSheet.absoluteFill} />}
      <LinearGradient colors={['transparent', 'rgba(12,24,32,0.78)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.65 }} />
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, gap: 2 }}>
        {kicker ? <T v="kicker" c={color.sand}>{kicker}</T> : null}
        <T v={big ? 'h1' : 'h3'} c={color.white} numberOfLines={2} style={!big ? { fontFamily: 'Roboto_300Light', fontSize: 22, lineHeight: 25 } : undefined}>{title ?? s?.title ?? wiki}</T>
        {line ? <T v="small" c="rgba(248,247,243,0.85)" numberOfLines={2}>{line}</T> : null}
      </View>
      {s?.image || s?.thumb ? (
        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(15,42,56,0.45)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <T v="micro" c="rgba(248,247,243,0.8)" style={{ fontSize: 9 }}>Wikimedia Commons</T>
        </View>
      ) : null}
    </Press>
  );
}
