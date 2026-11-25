// Stripe Checkout for web subscriptions. Uses the Stripe REST API directly (no SDK).
// Returns 503 until STRIPE_SECRET_KEY and the price IDs are set — it never fakes a purchase.
import { adminClient, env } from '@/lib/server';

const PRICE: Record<string, string | undefined> = {
  plus: process.env.STRIPE_PRICE_PLUS_MONTHLY,
  annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
};

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const admin = adminClient();
  if (!key || !admin) return Response.json({ error: 'payments_not_configured' }, { status: 503 });

  const jwt = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { plan } = await req.json().catch(() => ({ plan: '' }));
  const price = PRICE[plan];
  if (!price) return Response.json({ error: 'unknown_plan' }, { status: 400 });

  const origin = env.appUrl ?? new URL(req.url).origin;
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    client_reference_id: u.user.id,
    customer_email: u.user.email ?? '',
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancelled`,
    'subscription_data[metadata][user_id]': u.user.id,
    'subscription_data[metadata][plan]': plan,
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!r.ok) return Response.json({ error: 'stripe_error', detail: j.error?.message }, { status: 502 });
  return Response.json({ url: j.url });
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST' } });
}
