// RevenueCat on iOS and Android. Metro loads this file on native only; revenuecat.ts is the web stand-in.
//
// RevenueCat dashboard setup this code expects:
//   Entitlement  "plus"
//   Offering     the current offering, with a Monthly package ($rc_monthly) and an Annual package ($rc_annual)
//   Products     e.g. detourloop_plus_monthly / detourloop_plus_annual in App Store Connect and Google Play
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { config } from './config';

export type Plan = 'free' | 'plus' | 'annual';
export type StorePackage = { plan: 'plus' | 'annual'; priceString: string; pkg: PurchasesPackage };

export const ENTITLEMENT = 'plus';
const apiKey = Platform.OS === 'ios' ? config.revenueCatIosKey : config.revenueCatAndroidKey;

/** True when this build has a RevenueCat key for this platform. */
export const rcAvailable = Boolean(apiKey);

let configured = false;
let userId: string | undefined;

export function planFromInfo(ci: CustomerInfo): Plan {
  const e = ci.entitlements.active[ENTITLEMENT];
  if (!e) return 'free';
  return /annual|year/i.test(e.productIdentifier) ? 'annual' : 'plus';
}

/**
 * Configure once. With an account (cloud mode) the Supabase user id is the RevenueCat app user id,
 * so the webhook can update the right profile. In demo mode RevenueCat uses an anonymous id.
 */
export async function rcInit(appUserId?: string, onChange?: (p: Plan) => void) {
  if (!apiKey) return;
  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: appUserId ?? null });
    configured = true;
    userId = appUserId;
    if (onChange) Purchases.addCustomerInfoUpdateListener((ci) => onChange(planFromInfo(ci)));
  } else if (appUserId && appUserId !== userId) {
    await Purchases.logIn(appUserId);
    userId = appUserId;
  }
}

export async function rcPlan(): Promise<Plan | null> {
  if (!configured) return null;
  try { return planFromInfo(await Purchases.getCustomerInfo()); } catch { return null; }
}

/** Packages from the current offering, with the store's localised prices. */
export async function rcPackages(): Promise<StorePackage[]> {
  if (!configured) return [];
  const o = await Purchases.getOfferings();
  const cur = o.current;
  if (!cur) return [];
  const out: StorePackage[] = [];
  if (cur.annual) out.push({ plan: 'annual', priceString: cur.annual.product.priceString, pkg: cur.annual });
  if (cur.monthly) out.push({ plan: 'plus', priceString: cur.monthly.product.priceString, pkg: cur.monthly });
  return out;
}

export async function rcPurchase(p: StorePackage): Promise<{ plan: Plan; cancelled?: boolean; error?: string }> {
  try {
    const r = await Purchases.purchasePackage(p.pkg);
    return { plan: planFromInfo(r.customerInfo) };
  } catch (e: any) {
    if (e?.userCancelled) return { plan: 'free', cancelled: true };
    return { plan: 'free', error: e?.message ?? 'The purchase did not go through.' };
  }
}

export async function rcRestore(): Promise<{ plan: Plan; error?: string }> {
  try { return { plan: planFromInfo(await Purchases.restorePurchases()) }; }
  catch (e: any) { return { plan: 'free', error: e?.message ?? 'Could not restore purchases.' }; }
}
