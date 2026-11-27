// First-time onboarding: a cinematic intro, then interests → style. No account form: the app starts as a guest
// (cloud) or a device profile (demo). Returning iPhone users can Sign in with Apple on the first screen.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View , StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Interest, TravelStyle } from '@/data/types';
import { isCloud } from '@/services/config';
import { AppleButton, AppleButtonStyle, AppleButtonType, appleAvailable } from '@/services/apple';
import { DEFAULT_PREFS } from '@/services/personalization';
import { useStore } from '@/state/store';
import { HERO_WIKI } from '@/content/editorial';
import { INTERESTS, STYLES } from '@/content/options';
import { color, radius, space } from '@/theme/tokens';
import { Button, Chip, Icon, Press, T } from '@/components/ui/primitives';
import { Photo, useWiki } from '@/components/ui/media';
import { ModeBanner } from '@/components/ui/ModeBanner';
import { sizedThumb } from '@/services/photos';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { refresh } = useStore();
  const hero = useWiki(HERO_WIKI);
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [style, setStyle] = useState<TravelStyle>('spontaneous');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => { if (isCloud) appleAvailable().then(setApple); }, []);

  const toggle = (k: Interest) => setInterests((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  async function finish() {
    setErr(null);
    setBusy(true);
    try {
      await repo.startGuest();
      const p = await repo.getProfile();
      if (p) await repo.saveProfile({ ...p, prefs: { ...DEFAULT_PREFS, interests: interests.length ? interests : DEFAULT_PREFS.interests, style } });
      await refresh();
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithApple() {
    setErr(null);
    setBusy(true);
    try {
      const r = await repo.appleSignIn();
      if (r === 'cancelled') return;
      await refresh();
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Sign in with Apple did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const img = hero ? sizedThumb(hero.thumb, 1200) ?? hero.image : undefined;

  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: color.oceanDeep }}>
        <Animated.View entering={FadeIn.duration(900)} style={StyleSheet.absoluteFill}>
          <Photo uri={img} label={HERO_WIKI} style={{ flex: 1 }} />
        </Animated.View>
        <LinearGradient colors={['rgba(12,24,32,0.15)', 'rgba(12,24,32,0.35)', 'rgba(12,24,32,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.xl }}>
          <Animated.View entering={FadeInDown.delay(200)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="h3" c={color.sand} style={{ fontFamily: 'Roboto_300Light', fontSize: 22, letterSpacing: 0.3 }}>DetourLoop</T>
            <ModeBanner compact dark />
          </Animated.View>
          <View style={{ gap: space.lg }}>
            <Animated.View entering={FadeInUp.delay(350).springify().damping(18)}>
              <T v="hero" c={color.white} style={{ fontSize: 56, lineHeight: 58 }}>Explore beyond{'\n'}<T v="hero" c={color.sand} style={{ fontSize: 56, lineHeight: 58, fontFamily: 'Roboto_300Light_Italic' }}>the obvious.</T></T>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(550)}>
              <T v="body" c="rgba(248,247,243,0.85)">The best parts of a trip are the places you didn't plan. DetourLoop finds them along your route, then turns the journey into a story you can replay.</T>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(700)} style={{ gap: space.md, marginTop: space.md }}>
              <Button label="Begin your first adventure" v="sand" icon="arrow-forward" onPress={() => setStep(1)} />
              {apple ? (
                <AppleButton buttonType={AppleButtonType.SIGN_IN} buttonStyle={AppleButtonStyle.WHITE} cornerRadius={radius.md}
                  style={{ height: 48, opacity: busy ? 0.6 : 1 }} onPress={busy ? () => {} : signInWithApple} />
              ) : null}
              {err ? <T v="small" c={color.white} accessibilityRole="text">{err}</T> : null}
            </Animated.View>
            
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Press onPress={() => setStep(step - 1)} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-back" size={22} />
          </Press>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.ocean : color.cream }} />)}
          </View>
        </View>

        {step === 1 && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: space.lg }}>
            <T v="kicker" c={color.teal}>Step 1 of 2</T>
            <T v="h1">What makes a trip great for you?</T>
            <T v="body" c={color.inkSoft}>Pick as many as you like. DetourLoop uses these to choose which real places to show you.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {INTERESTS.map((i) => <Chip key={i.key} label={i.label} icon={i.icon} selected={interests.includes(i.key)} onPress={() => toggle(i.key)} />)}
            </View>
            <Button label={interests.length ? `Continue with ${interests.length}` : 'Skip for now'} icon="arrow-forward" onPress={() => setStep(2)} />
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: space.lg }}>
            <T v="kicker" c={color.teal}>Step 2 of 2</T>
            <T v="h1">How do you like to travel?</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {STYLES.map((s) => {
                const on = style === s.key;
                return (
                  <Press key={s.key} onPress={() => setStyle(s.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${s.label}. ${s.line}`}
                    style={{ width: '47%', minHeight: 120, padding: space.lg, borderRadius: radius.lg, backgroundColor: on ? color.ocean : '#FFFFFF', borderWidth: 1, borderColor: on ? color.ocean : color.line, gap: 6 }}>
                    <Icon name={s.icon} size={26} color={on ? color.sand : color.teal} />
                    <T v="bodyStrong" c={on ? color.white : color.ink}>{s.label}</T>
                    <T v="micro" c={on ? 'rgba(248,247,243,0.8)' : color.inkSoft}>{s.line}</T>
                  </Press>
                );
              })}
            </View>
            {err ? <T v="small" c={color.danger} accessibilityRole="text">{err}</T> : null}
            <Button label="Start exploring" icon="arrow-forward" loading={busy} onPress={finish} />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
