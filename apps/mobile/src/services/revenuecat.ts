// Web stand-in for revenuecat.native.ts. On the web, Plus is sold through Stripe Checkout
// (see subscriptions.ts), so RevenueCat is never loaded here.
export type Plan = 'free' | 'plus' | 'annual';
export type StorePackage = { plan: 'plus' | 'annual'; priceString: string; pkg: unknown };

export const ENTITLEMENT = 'plus';
export const rcAvailable = false;

export async function rcInit(_appUserId?: string, _onChange?: (p: Plan) => void) {}
export async function rcPlan(): Promise<Plan | null> { return null; }
export async function rcPackages(): Promise<StorePackage[]> { return []; }
export async function rcPurchase(_p: StorePackage): Promise<{ plan: Plan; cancelled?: boolean; error?: string }> {
  return { plan: 'free', error: 'In-app purchases are only available in the iOS and Android apps.' };
}
export async function rcRestore(): Promise<{ plan: Plan; error?: string }> {
  return { plan: 'free', error: 'Restore is only available in the iOS and Android apps.' };
}
