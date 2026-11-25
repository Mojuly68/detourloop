// Paywall. Prices load from remote config (app_config) with launch defaults.
// Purchases only happen through RevenueCat / Stripe; without them we say so and charge nothing.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/state/store';
import { DEFAULT_PLANS, PLUS_FEATURES, loadPlans, purchase, purchasesConfigured, type PlanInfo } from '@/services/subscriptions';
import { color, radius, space } from '@/theme/tokens';
import { Button, Icon, IconButton, Press, T } from '@/components/ui/primitives';
import { Photo, useWiki } from '@/components/ui/media';
import { notify } from '@/components/ui/confirm';
import { sizedThumb } from '@/services/photos';

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { profile } = useStore();
  const [plans, setPlans] = useState<PlanInfo[]>(DEFAULT_PLANS);
  const [pick, setPick] = useState<'plus' | 'annual'>('annual');
  const [busy, setBusy] = useState(false);
  const bg = useWiki('Lofoten');
  useEffect(() => { loadPlans().then(setPlans); }, []);

  const plus = plans.find((p) => p.id === 'plus')!;
  const annual = plans.find((p) => p.id === 'annual')!;
  const saving = Math.round((1 - annual.price / (plus.price * 12)) * 100);
  const current = profile?.plan ?? 'free';

  async function buy() {
    setBusy(true);
    try {
      const r = await purchase(pick);
      if (!r.ok) notify('Not available yet', r.message);
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.oceanDeep }}>
      <Photo uri={bg ? sizedThumb(bg.thumb, 960) : undefined} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
      <LinearGradient colors={['rgba(12,24,32,0.4)', 'rgba(12,24,32,0.97)']} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.xl, gap: space.lg }}>
        <View style={{ alignItems: 'flex-end' }}><IconButton icon="close" label="Close" tone="glass" onPress={() => router.back()} /></View>
        <View style={{ height: 120 }} />
        <T v="kicker" c={color.sand}>DetourLoop Plus</T>
        <T v="hero" c={color.white}>Go further. Remember more.</T>
        <View style={{ gap: space.md }}>
          {PLUS_FEATURES.map((f) => (
            <View key={f} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon name="checkmark-circle" size={20} color={color.sand} />
              <T v="body" c="rgba(248,247,243,0.9)" style={{ flex: 1 }}>{f}</T>
            </View>
          ))}
        </View>

        {current !== 'free' ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(248,247,243,0.1)' }}>
            <T v="bodyStrong" c={color.white}>You're on {current === 'annual' ? 'Plus Annual' : 'Plus'}. Thank you.</T>
            <T v="small" c="rgba(248,247,243,0.75)">Manage or cancel in your App Store / Google Play subscriptions, or the billing portal on the web.</T>
          </View>
        ) : (
          <>
            <View style={{ gap: space.md }}>
              <PlanCard on={pick === 'annual'} onPress={() => setPick('annual')} title="Annual" price={`$${annual.price.toFixed(2)} / year`} sub={`$${(annual.price / 12).toFixed(2)} a month · save ${saving}%`} badge="Best value" />
              <PlanCard on={pick === 'plus'} onPress={() => setPick('plus')} title="Monthly" price={`$${plus.price.toFixed(2)} / month`} sub="Cancel any time" />
            </View>
            <Button v="sand" label={`Continue with ${pick === 'annual' ? 'Annual' : 'Monthly'}`} loading={busy} onPress={buy} />
            {!purchasesConfigured() ? <T v="micro" c={color.sand} style={{ textAlign: 'center' }}>Purchases are not connected in this build. Nothing will be charged.</T> : null}
          </>
        )}
        <T v="micro" c="rgba(248,247,243,0.6)" style={{ textAlign: 'center' }}>
          Free stays free: trip planning, basic discovery, maps, the photo timeline and sharing. Your trips, photos and Replays are always yours to view and export, on any plan.
        </T>
      </ScrollView>
    </View>
  );
}

function PlanCard({ on, onPress, title, price, sub, badge }: { on: boolean; onPress: () => void; title: string; price: string; sub: string; badge?: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${title}, ${price}`}
      style={{ padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? color.sand : 'rgba(248,247,243,0.2)', backgroundColor: on ? 'rgba(215,197,167,0.12)' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? color.sand : 'rgba(248,247,243,0.4)', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.sand }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" c={color.white}>{title} · {price}</T>
        <T v="micro" c="rgba(248,247,243,0.7)">{sub}</T>
      </View>
      {badge ? <View style={{ backgroundColor: color.sand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><T v="micro" c={color.charcoal}>{badge}</T></View> : null}
    </Press>
  );
}
