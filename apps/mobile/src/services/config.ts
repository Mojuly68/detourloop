// Runtime configuration. Only PUBLIC values belong here (EXPO_PUBLIC_* is bundled into the app).
// Secret keys (OpenAI, Supabase service role, Stripe secret, RevenueCat secret) live only in
// Supabase Edge Function secrets or the web server environment. See .env.example.

const env = (k: string) => {
  const v = (process.env as Record<string, string | undefined>)[k];
  return v && v.trim() ? v.trim() : undefined;
};

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || undefined,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
  /** Public Mapbox token (pk.*). Optional: without it, maps use OpenFreeMap and routing uses OSRM. */
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() || undefined,
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || undefined,
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() || undefined,
  /** Base URL of the Next.js web app, used for share links. */
  webUrl: process.env.EXPO_PUBLIC_WEB_URL?.trim() || undefined,
  env,
};

/** Cloud mode = Supabase configured. Otherwise the app runs in clearly labelled demo mode (data on this device only). */
export const isCloud = Boolean(config.supabaseUrl && config.supabaseAnonKey);

export const providers = {
  map: config.mapboxToken ? 'Mapbox' : 'OpenFreeMap · OpenStreetMap',
  routing: config.mapboxToken ? 'Mapbox Directions' : 'OSRM (public demo server)',
  geocoding: config.mapboxToken ? 'Mapbox Geocoding' : 'Photon (Komoot) · OpenStreetMap',
  places: 'OpenStreetMap (Overpass API)',
  photos: 'Wikipedia · Wikimedia Commons',
  weather: 'Open-Meteo',
};
