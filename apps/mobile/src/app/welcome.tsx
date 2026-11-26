// First-time onboarding: a cinematic intro, then interests → style → account. Four steps, all skippable.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View , StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '@/data/repo';
import type { Interest, TravelStyle } from '@/data/types';
import { isCloud } from '@/services/config';
import { DEFAULT_PREFS } from '@/services/personalization';
import { useStore } from '@/state/store';
import { HERO_WIKI } from '@/content/editorial';
import { INTERESTS, STYLES } from '@/content/options';
import { color, radius, space } from '@/theme/tokens';
import { Button, Chip, Field, Icon, Press, T } from '@/components/ui/primitives';
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
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (k: Interest) => setInterests((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  async function finish() {
    setErr(null);
    if (isCloud) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
      if (password.length < 8) return setErr('Use at least 8 characters for your password.');
    }
    setBusy(true);
    try {
      if (mode === 'signup') await repo.signUp(email.trim(), password, name.trim());
      else await repo.signIn(email.trim(), password);
      const p = await repo.getProfile();
      if (!p && isCloud && mode === 'signup') {
        setErr('Check your inbox to confirm your email, then sign in.');
        setMode('signin');
        return;
      }
      if (p && mode === 'signup') {
        await repo.saveProfile({ ...p, displayName: name.trim() || p.displayName, prefs: { ...DEFAULT_PREFS, interests: interests.length ? interests : DEFAULT_PREFS.interests, style } });
      }
      await refresh();
      router.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong. Please try again.');
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
              {isCloud ? <Button label="I already have an account" v="light" onPress={() => { setMode('signin'); setStep(3); }} /> : null}
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
          <Press onPress={() => setStep(step === 3 && mode === 'signin' && interests.length === 0 ? 0 : step - 1)} accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-back" size={22} />
          </Press>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.ocean : color.cream }} />)}
          </View>
        </View>

        {step === 1 && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: space.lg }}>
            <T v="kicker" c={color.teal}>Step 1 of 3</T>
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
            <T v="kicker" c={color.teal}>Step 2 of 3</T>
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
            <Button label="Continue" icon="arrow-forward" onPress={() => setStep(3)} />
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: space.lg }}>
            <T v="kicker" c={color.teal}>{mode === 'signup' ? 'Step 3 of 3' : 'Welcome back'}</T>
            <T v="h1">{mode === 'signup' ? 'Save your journeys' : 'Sign in'}</T>
            {isCloud ? (
              <T v="body" c={color.inkSoft}>Your trips, photos and replays are stored privately in your account.</T>
            ) : (
              <View style={{ gap: space.sm, backgroundColor: '#F3E2C4', padding: space.lg, borderRadius: radius.md }}>
                <T v="bodyStrong" c="#6B4A12">Demo mode</T>
                <T v="small" c="#6B4A12">No account server is connected in this build, so your profile and trips are saved on this device only. No password is needed or stored. Connect Supabase (see README) for real accounts, sync and sharing.</T>
              </View>
            )}
            {mode === 'signup' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="What should we call you?" autoComplete="name" /> : null}
            <Field label={isCloud ? 'Email' : 'Email (optional)'} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            {isCloud ? <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /> : null}
            {err ? <T v="small" c={color.danger} accessibilityRole="text">{err}</T> : null}
            <Button label={mode === 'signup' ? (isCloud ? 'Create account' : 'Start exploring') : 'Sign in'} icon="arrow-forward" loading={busy} onPress={finish} />
            {isCloud ? (
              <Button v="ghost" label={mode === 'signup' ? 'I already have an account' : 'Create a new account'} onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} />
            ) : null}
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
