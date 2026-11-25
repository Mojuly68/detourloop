// Stripe webhook: verifies the signature, then sets the user's plan.
// Configure the endpoint in Stripe for: customer.subscription.created / updated / deleted.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { adminClient } from '@/lib/server';

function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = adminClient();
  if (!secret || !admin) return Response.json({ error: 'not_configured' }, { status: 503 });

  const payload = await req.text();
  if (!verify(payload, req.headers.get('stripe-signature'), secret)) return Response.json({ error: 'bad_signature' }, { status: 400 });

  const event = JSON.parse(payload);
  if (!String(event.type).startsWith('customer.subscription.')) return Response.json({ received: true });

  const sub = event.data.object;
  const userId = sub.metadata?.user_id;
  const plan = sub.metadata?.plan === 'annual' ? 'annual' : 'plus';
  if (!userId) return Response.json({ received: true });

  const active = ['active', 'trialing'].includes(sub.status) && event.type !== 'customer.subscription.deleted';
  await admin.from('subscriptions').upsert({
    user_id: userId, plan: active ? plan : 'free', status: active ? sub.status : 'canceled', provider: 'stripe', provider_ref: sub.id,
    renewal_date: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  await admin.from('profiles').update({ subscription_status: active ? plan : 'free' }).eq('id', userId);
  return Response.json({ received: true });
}
