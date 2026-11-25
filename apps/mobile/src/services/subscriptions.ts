// Subscription management. Prices come from the `app_config` table (remote config) with
// launch defaults as fallback. Purchases go through RevenueCat (mobile) or Stripe Checkout (web).
// Neither SDK is wired into this build yet: purchase() says so honestly instead of pretending.
//
// To enable:
//   Mobile: `npx expo install react-native-purchases`, set EXPO_PUBLIC_REVENUECAT_*_KEY, configure
//           entitlement "plus" with products detourloop_plus_monthly / detourloop_plus_annual, and point the
//           RevenueCat webhook at a function that updates `subscriptions` + `profiles.subscription_status`.
//   Web:    a Stripe Checkout session from the Next.js API route (apps/web/src/app/api/checkout) and a
//           webhook that does the same updates. See docs/DEPLOYMENT.md.
import { Platform } from 'react-native';
import type { Profile } from '@/data/types';
import { config } from './config';
import { supabase } from './supabase';

export interface PlanInfo { id: 'free' | 'plus' | 'annual'; price: number; currency: string; period: 'month' | 'year' | null; aiPerDay: number; activeTrips: number; mediaMb: number; }

export const DEFAULT_PLANS: PlanInfo[] = [
  { id: 'free', price: 0, currency: 'USD', period: null, aiPerDay: 10, activeTrips: 3, mediaMb: 500 },
  { id: 'plus', price: 7.99, currency: 'USD', period: 'month', aiPerDay: 200, activeTrips: 50, mediaMb: 20000 },
  { id: 'annual', price: 59.99, currency: 'USD', period: 'year', aiPerDay: 200, activeTrips: 50, mediaMb: 20000 },
];

export async function loadPlans(): Promise<PlanInfo[]> {
  if (!supabase) return DEFAULT_PLANS;
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'plans').single();
    const v = data?.value;
    if (!v) return DEFAULT_PLANS;
    return (['free', 'plus', 'annual'] as const).map((id) => ({
      id, price: v[id].price, currency: v[id].currency, period: v[id].period, aiPerDay: v[id].ai_discoveries_per_day, activeTrips: v[id].active_trips, mediaMb: v[id].media_mb,
    }));
  } catch {
    return DEFAULT_PLANS;
  }
}

export const PLUS_FEATURES = [
  'Advanced AI discoveries and personalised picks',
  'More active trips',
  'Advanced TravelReplay with animated journey maps',
  'AI travel stories',
  'Premium video templates and high-quality exports',
  'More media storage',
];

export type Feature = 'ai_story' | 'premium_templates' | 'hq_export' | 'many_trips';

/** Entitlement check. Never gates access to the user's own data — only extra capabilities. */
export function hasEntitlement(p: Profile | null, f: Feature) {
  void f; // every listed feature is a Plus feature today; per-feature rules can branch here
  return p?.plan === 'plus' || p?.plan === 'annual';
}

export function purchasesConfigured() {
  if (Platform.OS === 'ios') return Boolean(config.revenueCatIosKey);
  if (Platform.OS === 'android') return Boolean(config.revenueCatAndroidKey);
  return Boolean(config.webUrl && supabase);
}

export async function purchase(plan: 'plus' | 'annual'): Promise<{ ok: boolean; message: string }> {
  if (!purchasesConfigured()) {
    return { ok: false, message: 'Purchases are not set up in this build. Add RevenueCat (mobile) or Stripe (web) keys — see docs/DEPLOYMENT.md. No charge was made.' };
  }
  if (Platform.OS === 'web') {
    const { data } = await supabase!.auth.getSession();
    const r = await fetch(`${config.webUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ plan }),
    });
    if (!r.ok) return { ok: false, message: 'Checkout is unavailable right now. No charge was made.' };
    const { url } = await r.json();
    if (url) (globalThis as any).location.href = url;
    return { ok: true, message: 'Opening secure checkout…' };
  }
  return { ok: false, message: 'RevenueCat keys are set but the react-native-purchases SDK is not installed in this build yet. No charge was made.' };
}
