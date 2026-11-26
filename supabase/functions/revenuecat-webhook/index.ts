// DetourLoop — RevenueCat webhook (Deno, Supabase).
// RevenueCat calls this on every subscription event. It updates public.subscriptions and
// profiles.subscription_status, which the app and the AI rate limits read.
//
// Setup (RevenueCat → Project → Integrations → Webhooks):
//   URL:                  https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: the value of the REVENUECAT_WEBHOOK_AUTH secret, e.g. "Bearer <long random string>"
//   supabase secrets set REVENUECAT_WEBHOOK_AUTH="Bearer <long random string>"
// Deploy with --no-verify-jwt (RevenueCat does not send a Supabase JWT):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// The app logs in to RevenueCat with the Supabase user id, so app_user_id is the profile id.
// Anonymous ids ($RCAnonymousID:…, demo mode) have no profile and are acknowledged and ignored.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");

const ENTITLEMENT = "plus";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

/** Constant-time string compare, so the secret cannot be guessed byte by byte. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!AUTH) return json({ error: "REVENUECAT_WEBHOOK_AUTH is not set" }, 500);
  if (!same(req.headers.get("Authorization") ?? "", AUTH)) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const e = body?.event;
  if (!e?.type) return json({ error: "no event" }, 400);
  if (e.type === "TEST") return json({ ok: true, test: true });

  // TRANSFER moves a purchase between users; update both sides.
  const users: string[] = e.type === "TRANSFER"
    ? [...(e.transferred_from ?? []), ...(e.transferred_to ?? [])]
    : [e.app_user_id, ...(e.aliases ?? [])];
  const ids = [...new Set(users.filter((u) => typeof u === "string" && UUID.test(u)))];
  if (ids.length === 0) return json({ ok: true, ignored: "no account user id" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Access is current while the event carries the "plus" entitlement and its expiration is in the
  // future. A CANCELLATION keeps access until then (auto-renew off); EXPIRATION ends it.
  const hasPlus = (e.entitlement_ids ?? (e.entitlement_id ? [e.entitlement_id] : [])).includes(ENTITLEMENT);
  const expires = typeof e.expiration_at_ms === "number" ? new Date(e.expiration_at_ms) : null;
  const active = hasPlus && e.type !== "EXPIRATION" && (!expires || expires.getTime() > Date.now());
  const plan = active ? (/annual|year/i.test(e.product_id ?? "") ? "annual" : "plus") : "free";
  const status = e.type === "EXPIRATION" ? "expired"
    : e.type === "BILLING_ISSUE" ? "past_due"
    : e.type === "CANCELLATION" ? "canceled"
    : e.period_type === "TRIAL" ? "trialing"
    : "active";

  for (const userId of ids) {
    const { data: prof } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!prof) continue;
    // A transfer away from a user means they no longer own it.
    const losing = e.type === "TRANSFER" && (e.transferred_from ?? []).includes(userId);
    const p = losing ? "free" : plan;
    await admin.from("subscriptions").upsert({
      user_id: userId, plan: p, status: losing ? "expired" : status, provider: "revenuecat",
      provider_ref: e.original_transaction_id ?? e.transaction_id ?? null,
      renewal_date: expires?.toISOString() ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await admin.from("profiles").update({ subscription_status: p }).eq("id", userId);
  }
  return json({ ok: true, plan });
});
