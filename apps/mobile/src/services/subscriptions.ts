// Subscription management. Prices for display come from the store (RevenueCat) on iOS/Android,
// otherwise from the `app_config` table (remote config) with launch defaults as fallback.
// Purchases: RevenueCat on iOS/Android, Stripe Checkout on the web. With no keys, purchase()
// says so honestly and charges nothing.
//
// The plan the app trusts:
//   - RevenueCat's customer info on the device (entitlement "plus"), as soon as it is known;
//   - otherwise profile.plan, which in cloud mode is set only by the RevenueCat / Stripe webhooks.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { Profile } from '@/data/types';
import { config } from './config';
import { supabase } from './supabase';
import { rcAvailable, rcInit, rcPackages, rcPlan, rcPurchase, rcRestore, type Plan, type StorePackage } from './revenuecat';

export type { Plan, StorePackage };

// ── Live plan from the store ────────────────────────────────────────────────
let storePlan: Plan | null = null;
const listeners = new Set<() => void>();
function setStorePlan(p: Plan | null) {
  if (p === storePlan) return;
  storePlan = p;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The plan to show and enforce: the store's answer when known, else the profile's. */
export function effectivePlan(p: Profile | null): Plan {
  return storePlan ?? p?.plan ?? 'free';
}
/** Re-renders when the store reports a change (purchase, restore, renewal, expiry). */
export function usePlan(p: Profile | null): Plan {
  useSyncExternalStore(subscribe, () => storePlan, () => storePlan);
  return effectivePlan(p);
}

/** Call once a profile exists. Cloud mode passes the account id so purchases follow the account. */
export async function initPurchases(accountId?: string) {
  if (!rcAvailable) return;
  await rcInit(accountId, setStorePlan);
  setStorePlan(await rcPlan());
}

export interface PlanInfo { id: 'free' | 'plus' | 'annual'; price: number; currency: string; period: 'month' | 'year' | null; aiPerDay: number; activeTrips: number; mediaMb: number; }

export const DEFAULT_PLANS: PlanInfo[] = [
  { id: 'free', price: 0, currency: 'USD', period: null, aiPerDay: 10, activeTrips: 3, mediaMb: 500 },
  { id: 'plus', price: 2.29, currency: 'USD', period: 'month', aiPerDay: 200, activeTrips: 50, mediaMb: 20000 },
  { id: 'annual', price: 24, currency: 'USD', period: 'year', aiPerDay: 200, activeTrips: 50, mediaMb: 20000 },
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
  const plan = effectivePlan(p);
  return plan === 'plus' || plan === 'annual';
}

export function purchasesConfigured() {
  if (Platform.OS === 'web') return Boolean(config.webUrl && supabase);
  return rcAvailable;
}

/** Store packages with localised prices (empty on web or without a RevenueCat key). */
export function storePackages(): Promise<StorePackage[]> {
  return rcPackages().catch(() => []);
}

export async function purchase(plan: 'plus' | 'annual', packages: StorePackage[] = []): Promise<{ ok: boolean; message: string; cancelled?: boolean }> {
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
  const pkg = packages.find((x) => x.plan === plan) ?? (await storePackages()).find((x) => x.plan === plan);
  if (!pkg) return { ok: false, message: 'This plan is not available from the store right now. No charge was made.' };
  const r = await rcPurchase(pkg);
  if (r.cancelled) return { ok: false, cancelled: true, message: '' };
  if (r.error) return { ok: false, message: `${r.error} No charge was made.` };
  setStorePlan(r.plan);
  return r.plan === 'free'
    ? { ok: false, message: 'The store did not confirm the subscription. If you were charged, use Restore purchases.' }
    : { ok: true, message: 'Welcome to DetourLoop Plus.' };
}

export async function restorePurchases(): Promise<{ ok: boolean; message: string }> {
  const r = await rcRestore();
  if (r.error) return { ok: false, message: r.error };
  setStorePlan(r.plan);
  return r.plan === 'free'
    ? { ok: false, message: 'No active DetourLoop Plus subscription was found for this Apple / Google account.' }
    : { ok: true, message: 'Your Plus subscription is restored.' };
}
