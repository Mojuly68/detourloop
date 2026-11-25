// Server-only helpers. The service-role key never reaches the browser: it is read here, in
// Server Components and Route Handlers only.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

export const configured = Boolean(env.url && env.anon);

export function anonClient() {
  if (!env.url || !env.anon) return null;
  return createClient(env.url, env.anon, { auth: { persistSession: false } });
}

export function adminClient() {
  if (!env.url || !env.service) return null;
  return createClient(env.url, env.service, { auth: { persistSession: false } });
}

export interface WikiSummary { title: string; extract?: string; image?: string; url: string }

/** Wikipedia summary + a standard-width thumbnail (Wikimedia only serves fixed widths). */
export async function wiki(title: string, width = 1280): Promise<WikiSummary | null> {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const j = await r.json();
    const thumb: string | undefined = j.thumbnail?.source;
    return { title: j.title, extract: j.extract, image: thumb ? thumb.replace(/\/\d+px-/, `/${width}px-`) : j.originalimage?.source, url: j.content_urls?.desktop?.page };
  } catch {
    return null;
  }
}

export const DEFAULT_PLANS = {
  free: { price: 0, period: null as string | null },
  plus: { price: 7.99, period: 'month' },
  annual: { price: 59.99, period: 'year' },
};

export async function plans() {
  const c = anonClient();
  if (!c) return DEFAULT_PLANS;
  const { data } = await c.from('app_config').select('value').eq('key', 'plans').single();
  return (data?.value as typeof DEFAULT_PLANS) ?? DEFAULT_PLANS;
}
