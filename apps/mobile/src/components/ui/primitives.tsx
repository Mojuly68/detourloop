// DetourLoop component library — primitives.
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { color, font, radius, shadow, size, space, touch } from '@/theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size: s = 20, color: c = color.ocean }: { name: IconName | string; size?: number; color?: string }) => (
  <Ionicons name={name as IconName} size={s} color={c} />
);

export const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

// ── Typography ──────────────────────────────────────────────────────────────
type TV = 'hero' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'micro' | 'label' | 'kicker';
const tv: Record<TV, TextStyle> = {
  hero: { fontFamily: font.bold, fontSize: size.hero, lineHeight: size.hero * 1.1, letterSpacing: -0.8 },
  h1: { fontFamily: font.semibold, fontSize: size.h1, lineHeight: size.h1 * 1.15, letterSpacing: -0.5 },
  h2: { fontFamily: font.semibold, fontSize: size.h2, lineHeight: size.h2 * 1.2, letterSpacing: -0.3 },
  h3: { fontFamily: font.medium, fontSize: size.h3, lineHeight: size.h3 * 1.25, letterSpacing: -0.1 },
  body: { fontFamily: font.body, fontSize: size.body, lineHeight: size.body * 1.5 },
  bodyStrong: { fontFamily: font.semibold, fontSize: size.body, lineHeight: size.body * 1.45 },
  small: { fontFamily: font.medium, fontSize: size.small, lineHeight: size.small * 1.45 },
  micro: { fontFamily: font.medium, fontSize: size.micro, lineHeight: size.micro * 1.4 },
  label: { fontFamily: font.semibold, fontSize: size.small, letterSpacing: 0.2 },
  kicker: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
};
export function T({ v = 'body', c = color.ink, style, children, ...rest }: { v?: TV; c?: string; style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number; accessibilityRole?: 'header' | 'text'; maxFontSizeMultiplier?: number }) {
  // Large-text settings still scale type, but capped so layouts hold.
  return <Text maxFontSizeMultiplier={1.2} {...rest} style={[tv[v], { color: c }, style]}>{children}</Text>;
}

// ── Pressable with spring scale ─────────────────────────────────────────────
const APressable = Animated.createAnimatedComponent(Pressable);
export function Press({ style, children, scaleTo = 0.97, onPress, ...rest }: PressableProps & { scaleTo?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      accessibilityRole="button"
      {...rest}
      onPress={(e) => { tap(); onPress?.(e); }}
      onPressIn={() => { s.value = withSpring(scaleTo, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      style={[a, style]}
    >
      {children}
    </APressable>
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
type BV = 'primary' | 'secondary' | 'ghost' | 'sand' | 'light' | 'danger';
const bv: Record<BV, { bg: string; fg: string; border?: string }> = {
  primary: { bg: color.ocean, fg: color.white },
  secondary: { bg: color.card, fg: color.ocean, border: color.tileLine },
  ghost: { bg: 'transparent', fg: color.ocean },
  sand: { bg: color.sand, fg: color.charcoal },
  light: { bg: color.card, fg: color.ocean },
  danger: { bg: 'transparent', fg: color.danger, border: color.danger },
};
export function Button({ label, onPress, v = 'primary', icon, loading, disabled, style, small, accessibilityLabel }: { label: string; onPress?: () => void; v?: BV; icon?: string; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean; accessibilityLabel?: string }) {
  const c = bv[v];
  const chip = !!icon && !small && (v === 'primary' || v === 'sand' || v === 'light');
  return (
    <Press
      onPress={disabled || loading ? undefined : onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        { minHeight: small ? 38 : touch, paddingHorizontal: small ? space.lg : space.xl, borderRadius: radius.pill, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm, opacity: disabled ? 0.45 : 1 },
        c.border ? { borderWidth: 1, borderColor: c.border } : null,
        v === 'primary' && !small ? shadow.soft : null,
        chip ? { paddingLeft: 6, justifyContent: 'flex-start' } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : chip ? (
        // Leading icon in its own round chip — the signature button of the design.
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: v === 'primary' ? 'rgba(248,247,243,0.14)' : 'rgba(30,42,48,0.08)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon!} size={17} color={v === 'primary' ? color.sand : c.fg} />
        </View>
      ) : icon ? <Icon name={icon} size={small ? 16 : 19} color={c.fg} /> : null}
      <T v="label" c={c.fg} numberOfLines={1} style={[{ fontSize: small ? 13 : 14.5 }, chip ? { flex: 1, textAlign: 'center', marginRight: 14 } : null]}>{label}</T>
    </Press>
  );
}

export function IconButton({ icon, onPress, label, tone = 'light', size: s = 44 }: { icon: string; onPress?: () => void; label: string; tone?: 'light' | 'dark' | 'glass'; size?: number }) {
  const bg = tone === 'dark' ? color.ocean : tone === 'glass' ? 'rgba(250,246,240,0.92)' : color.card;
  return (
    <Press onPress={onPress} accessibilityLabel={label} hitSlop={6} style={[{ width: s, height: s, borderRadius: s / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, shadow.soft]}>
      <Icon name={icon} size={s * 0.45} color={tone === 'dark' ? color.white : color.ocean} />
    </Press>
  );
}

// ── Chip (selectable) ───────────────────────────────────────────────────────
export function Chip({ label, icon, selected, onPress, tone = 'light' }: { label: string; icon?: string; selected?: boolean; onPress?: () => void; tone?: 'light' | 'dark' }) {
  const on = selected;
  const fg = on ? color.white : tone === 'dark' ? color.white : color.ocean;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!on }}
      style={{
        minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: on ? color.ocean : tone === 'dark' ? 'rgba(248,247,243,0.12)' : color.card,
        borderWidth: 1, borderColor: on ? color.ocean : tone === 'dark' ? 'rgba(248,247,243,0.3)' : color.tileLine,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <T v="label" c={fg}>{label}</T>
    </Press>
  );
}

export function Pill({ label, icon, tone = 'cream', style }: { label: string; icon?: string; tone?: 'cream' | 'ocean' | 'glass' | 'sand' | 'warn'; style?: StyleProp<ViewStyle> }) {
  const map = { cream: [color.cream, color.charcoal], ocean: [color.ocean, color.white], glass: ['rgba(15,42,56,0.62)', color.white], sand: [color.sand, color.charcoal], warn: ['#F3E2C4', '#6B4A12'] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <T v="micro" c={fg}>{label}</T>
    </View>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────
export function SectionHeader({ kicker, title, action, onAction }: { kicker?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: space.xl, marginBottom: space.md }}>
      <View style={{ flex: 1 }}>
        {kicker ? <T v="kicker" c={color.teal}>{kicker}</T> : null}
        <T v="h2" accessibilityRole="header">{title}</T>
      </View>
      {action ? (
        <Press onPress={onAction} accessibilityLabel={action} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="label" c={color.teal}>{action}</T>
        </Press>
      ) : null}
    </View>
  );
}

export function Card({ children, style, tone = 'white' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'cream' | 'ocean' }) {
  const bg = tone === 'cream' ? color.tile : tone === 'ocean' ? color.ocean : color.card;
  return <View style={[{ backgroundColor: bg, borderRadius: radius.lg, padding: space.lg }, tone === 'cream' ? { borderWidth: 1, borderColor: color.tileLine } : shadow.card, style]}>{children}</View>;
}

export function Divider() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: space.md }} />; }

/** Square tile with a thin outline icon and a short label (category / interest shortcuts). */
export function IconTile({ icon, label, onPress, selected }: { icon: string; label: string; onPress?: () => void; selected?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} accessibilityState={{ selected: !!selected }}
      style={[{ width: 82, height: 76, borderRadius: radius.md, backgroundColor: selected ? color.ocean : color.tile, borderWidth: 1, borderColor: selected ? color.ocean : color.tileLine, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 4 }]}>
      <Icon name={icon} size={22} color={selected ? color.sand : color.ocean} />
      <T v="micro" c={selected ? color.white : color.ink} numberOfLines={1} maxFontSizeMultiplier={1} style={{ textAlign: 'center', fontSize: 11.5 }}>{label}</T>
    </Press>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────
export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="label" c={color.inkSoft}>{label}</T> : null}
      <TextInput
        placeholderTextColor={color.gray}
        maxFontSizeMultiplier={1.2}
        {...p}
        style={[{ minHeight: touch + 4, borderRadius: radius.md, borderWidth: 1, borderColor: color.tileLine, backgroundColor: color.card, paddingHorizontal: space.lg, fontFamily: font.body, fontSize: 16, color: color.ink }, style]}
      />
    </View>
  );
}

// ── Feedback states ─────────────────────────────────────────────────────────
export function Skeleton({ w = '100%', h = 16, r = radius.sm, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityLabel="Loading" style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#E6EAEC' }, a, style]} />;
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: string; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.lg, paddingHorizontal: space.xl, gap: space.sm }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color.cream, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={color.teal} />
      </View>
      <T v="h3" style={{ textAlign: 'center' }}>{title}</T>
      <T v="small" c={color.inkSoft} style={{ textAlign: 'center', maxWidth: 300 }}>{body}</T>
      {action ? <Button label={action} onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: '#F6E6DF', marginHorizontal: space.xl }}>
      <Icon name="cloud-offline-outline" size={22} color={color.danger} />
      <T v="small" c={color.charcoal} style={{ flex: 1 }}>{message}</T>
      {onRetry ? <Button label="Retry" v="ghost" small onPress={onRetry} /> : null}
    </View>
  );
}

/** Honest provenance label: tells the user where a piece of content came from. */
export function SourceTag({ source }: { source: 'ai' | 'map-data' | 'template' | 'user' | 'wikipedia' | 'estimate' }) {
  const m = {
    ai: ['sparkles', 'AI-generated'],
    'map-data': ['map-outline', 'From map data · not AI'],
    template: ['document-text-outline', 'Written from your trip data · not AI'],
    user: ['create-outline', 'Edited by you'],
    wikipedia: ['book-outline', 'Wikipedia'],
    estimate: ['time-outline', 'Estimate'],
  } as const;
  const [icon, label] = m[source];
  return <Pill icon={icon} label={label} tone={source === 'ai' ? 'ocean' : 'cream'} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={color.teal} />
      {label ? <T v="small" c={color.inkSoft}>{label}</T> : null}
    </View>
  );
}

/** Small toast for success feedback. */
export function Toast({ text, visible }: { text: string; visible: boolean }) {
  const y = useSharedValue(80);
  useEffect(() => { y.value = withSpring(visible ? 0 : 80, { damping: 16, stiffness: 180 }); }, [visible, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 1 - y.value / 80 }));
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[{ position: 'absolute', left: space.xl, right: space.xl, bottom: 24, backgroundColor: color.oceanDeep, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.sm, zIndex: 50 }, a]}>
      <Icon name="checkmark-circle" size={18} color={color.sand} />
      <T v="label" c={color.white}>{text}</T>
    </Animated.View>
  );
}

export function useToast() {
  const [state, set] = React.useState({ text: '', visible: false });
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = React.useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    set({ text, visible: true });
    timer.current = setTimeout(() => set((s) => ({ ...s, visible: false })), 2200);
  }, []);
  return { show, node: <Toast text={state.text} visible={state.visible} /> };
}
