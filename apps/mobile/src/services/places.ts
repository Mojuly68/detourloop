// DiscoveryService (data half): finds REAL places from OpenStreetMap via the Overpass API,
// along a route (Overpass supports `around` a polyline) or around a point.
// Distances are computed from coordinates; detour time is a labelled estimate until the
// route is recalculated with the stop included.
import type { Discovery, Interest, LngLat, Transport } from '@/data/types';
import { distanceToLineKm, estimateDetourMin, haversineKm, samplePoints } from './geo';
import { sizedThumb, wikiSummary, wikidataImage } from './photos';

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export interface CategoryDef {
  key: string;
  label: string;
  icon: string;          // Ionicons name
  visitMin: number;      // estimate
  selectors: string[];   // Overpass tag selectors
  interests: Interest[];
}

export const CATEGORY: CategoryDef[] = [
  { key: 'viewpoint', label: 'Scenic viewpoint', icon: 'eye-outline', visitMin: 20, selectors: ['["tourism"="viewpoint"]'], interests: ['scenic', 'photography', 'nature'] },
  { key: 'beach', label: 'Beach', icon: 'sunny-outline', visitMin: 60, selectors: ['["natural"="beach"]'], interests: ['beaches', 'nature', 'surfing', 'photography'] },
  { key: 'waterfall', label: 'Waterfall', icon: 'water-outline', visitMin: 45, selectors: ['["waterway"="waterfall"]', '["natural"="waterfall"]'], interests: ['nature', 'hiking', 'photography'] },
  { key: 'peak', label: 'Summit', icon: 'triangle-outline', visitMin: 120, selectors: ['["natural"="peak"]["wikidata"]'], interests: ['hiking', 'adventure', 'nature'] },
  { key: 'park', label: 'Nature reserve', icon: 'leaf-outline', visitMin: 90, selectors: ['["leisure"="nature_reserve"]["name"]', '["boundary"="national_park"]'], interests: ['nature', 'hiking'] },
  { key: 'trailhead', label: 'Trailhead', icon: 'walk-outline', visitMin: 120, selectors: ['["highway"="trailhead"]'], interests: ['hiking', 'adventure'] },
  { key: 'camp', label: 'Campground', icon: 'bonfire-outline', visitMin: 0, selectors: ['["tourism"="camp_site"]'], interests: ['camping', 'stays'] },
  { key: 'hut', label: 'Unique stay', icon: 'home-outline', visitMin: 0, selectors: ['["tourism"~"^(alpine_hut|wilderness_hut)$"]', '["tourism"~"^(hotel|guest_house)$"]["wikidata"]'], interests: ['stays', 'adventure'] },
  { key: 'surf', label: 'Surf spot', icon: 'boat-outline', visitMin: 90, selectors: ['["sport"="surfing"]'], interests: ['surfing', 'beaches'] },
  { key: 'food', label: 'Local food', icon: 'restaurant-outline', visitMin: 60, selectors: ['["amenity"~"^(restaurant|cafe)$"]["cuisine"]["website"]', '["amenity"="marketplace"]', '["shop"="bakery"]["website"]'], interests: ['food', 'local'] },
  { key: 'town', label: 'Small town', icon: 'business-outline', visitMin: 75, selectors: ['["place"~"^(town|village)$"]["wikipedia"]'], interests: ['historic', 'local', 'food'] },
  { key: 'historic', label: 'Historic site', icon: 'library-outline', visitMin: 45, selectors: ['["historic"]["wikipedia"]', '["historic"~"^(castle|ruins|fort|monument|lighthouse)$"]'], interests: ['historic', 'architecture'] },
  { key: 'lighthouse', label: 'Lighthouse', icon: 'flashlight-outline', visitMin: 30, selectors: ['["man_made"="lighthouse"]'], interests: ['scenic', 'photography', 'historic', 'architecture'] },
  { key: 'museum', label: 'Museum', icon: 'color-palette-outline', visitMin: 75, selectors: ['["tourism"~"^(museum|gallery)$"]'], interests: ['local', 'architecture', 'historic'] },
  { key: 'attraction', label: 'Local attraction', icon: 'sparkles-outline', visitMin: 45, selectors: ['["tourism"="attraction"]["wikidata"]'], interests: ['local', 'adventure', 'photography'] },
  { key: 'cave', label: 'Cave', icon: 'moon-outline', visitMin: 60, selectors: ['["natural"="cave_entrance"]["name"]'], interests: ['adventure', 'nature'] },
  { key: 'climbing', label: 'Climbing area', icon: 'fitness-outline', visitMin: 150, selectors: ['["sport"="climbing"]["climbing"="area"]', '["sport"="climbing"]["leisure"]'], interests: ['adventure'] },
  { key: 'hotspring', label: 'Hot spring', icon: 'thermometer-outline', visitMin: 60, selectors: ['["natural"="hot_spring"]'], interests: ['nature', 'adventure', 'stays'] },
];

export const categoryByKey = Object.fromEntries(CATEGORY.map((c) => [c.key, c])) as Record<string, CategoryDef>;

export function categoriesFor(interests: Interest[]): CategoryDef[] {
  if (!interests.length) return CATEGORY.filter((c) => ['viewpoint', 'beach', 'waterfall', 'town', 'historic', 'attraction', 'lighthouse'].includes(c.key));
  return CATEGORY.filter((c) => c.interests.some((i) => interests.includes(i)));
}

function classify(tags: Record<string, string>): CategoryDef | undefined {
  // First category whose selectors' leading key=value match. Order in CATEGORY = priority.
  for (const c of CATEGORY) {
    for (const s of c.selectors) {
      const parts = [...s.matchAll(/\["([^"]+)"(?:(=|~)"([^"]+)")?\]/g)];
      const ok = parts.every(([, k, op, v]) => {
        const val = tags[k];
        if (val === undefined) return false;
        if (!op) return true;
        if (op === '=') return val === v;
        return new RegExp(v).test(val);
      });
      if (ok) return c;
    }
  }
  return undefined;
}

/** Races the Overpass mirrors; first good answer wins. Each attempt is capped at `ms`. */
async function overpass(query: string, signal?: AbortSignal, ms = 22000): Promise<any[]> {
  const ctls = OVERPASS.map(() => new AbortController());
  const onAbort = () => ctls.forEach((c) => c.abort());
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(onAbort, ms);
  try {
    return await Promise.any(
      OVERPASS.map(async (url, i) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query), signal: ctls[i].signal });
        if (!r.ok) throw new Error(`Overpass ${r.status}`);
        const j = await r.json();
        return (j.elements ?? []) as any[];
      }),
    );
  } catch {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    throw new Error('OpenStreetMap place search is busy right now');
  } finally {
    clearTimeout(timer);
    onAbort();
    signal?.removeEventListener('abort', onAbort);
  }
}

// ── Wikipedia GeoSearch: a second, independent source of real, notable places ──────────
// Fast and reliable; every result has real coordinates, a summary and usually a photo.
const WIKI_RULES: [RegExp, string][] = [
  [/\bbeach\b/i, 'beach'], [/waterfall|\bfalls\b/i, 'waterfall'], [/lighthouse/i, 'lighthouse'],
  [/hot spring/i, 'hotspring'], [/\bcave\b|cavern/i, 'cave'], [/campground|camp ?site/i, 'camp'],
  [/mountain|\bpeak\b|summit|volcano|\bbutte\b|\bdome\b/i, 'peak'], [/trail\b/i, 'trailhead'],
  [/viewpoint|vista|overlook|scenic/i, 'viewpoint'],
  [/national park|state park|state beach|preserve|reserve|wilderness|forest|redwood|canyon|\bpark\b|garden/i, 'park'],
  [/museum|gallery/i, 'museum'],
  [/mission|historic|castle|fort\b|ruins|landmark|monument|bridge|pier|wharf|lodge|inn\b|hotel|church|cathedral|ranch|winery/i, 'historic'],
  [/\b(town|village|city|census-designated place|unincorporated community|community)\b/i, 'town'],
  [/island|bay|cove|point\b|cape|lake|river|cliff|coast|dunes|rock\b|arch/i, 'attraction'],
];
const WIKI_SKIP = /school|university|college|hospital|airport|station|company|corporation|highway|route|interstate|road|street|county|district|neighborhood|electoral|census tract|cemetery|prison|power plant|shopping|stadium|radio|television|newspaper|organization|people|person|album|film|band|election|military base|air force/i;

async function wikiGeo(p: { lat: number; lng: number }, radiusM: number, signal?: AbortSignal): Promise<any[]> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${p.lat.toFixed(5)}|${p.lng.toFixed(5)}&ggsradius=${Math.min(10000, Math.max(100, radiusM))}&ggslimit=40&prop=coordinates|pageimages|description|extracts&exintro=1&explaintext=1&exsentences=2&exlimit=40&piprop=thumbnail&pithumbsize=500`;
  const r = await fetch(u, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values(j.query?.pages ?? {});
}

function wikiToDiscovery(pg: any, origin: { line?: LngLat[]; point?: { lat: number; lng: number } }, mode: Transport): Discovery | null {
  const c = pg.coordinates?.[0];
  if (!c) return null;
  const desc: string = pg.description ?? '';
  if (WIKI_SKIP.test(desc) || /^List of/.test(pg.title)) return null;
  // The short description ("City in California", "Beach in Monterey County") is the most reliable signal;
  // the title is only used when there is no description.
  const hit = desc ? WIKI_RULES.find(([re]) => re.test(desc)) : WIKI_RULES.find(([re]) => re.test(pg.title));
  if (!hit) return null;
  const cat = categoryByKey[hit[1]];
  const d = origin.line ? distanceToLineKm({ lat: c.lat, lng: c.lon }, origin.line).km : haversineKm(origin.point!, { lat: c.lat, lng: c.lon });
  return {
    placeId: `wiki:${pg.pageid}`,
    name: pg.title.replace(/ \(.*\)$/, ''),
    lat: c.lat,
    lng: c.lon,
    category: cat.key,
    categoryLabel: cat.label,
    tags: { wikipedia: `en:${pg.title}`, description: desc },
    source: 'wikipedia',
    distanceKm: d,
    detourMin: origin.line ? estimateDetourMin(d, mode) : estimateDetourMin(d / 2, mode),
    visitMin: cat.visitMin,
    imageUrl: pg.thumbnail?.source,
    imageCredit: pg.thumbnail?.source ? 'Wikimedia Commons' : undefined,
    summary: pg.extract || undefined,
    summarySource: pg.extract ? 'wikipedia' : undefined,
    wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pg.title.replace(/ /g, '_'))}`,
    score: 0,
  };
}

/** Run up to `n` promises at a time. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => undefined as unknown as R); }
  }));
  return out;
}

/** Points every ~`stepKm` along a line. */
function pointsEvery(line: LngLat[], stepKm: number, max: number) {
  const out: { lat: number; lng: number }[] = [];
  let acc = stepKm;
  for (let i = 1; i < line.length; i++) {
    const a = { lng: line[i - 1][0], lat: line[i - 1][1] }, b = { lng: line[i][0], lat: line[i][1] };
    acc += haversineKm(a, b);
    if (acc >= stepKm) { out.push(b); acc = 0; }
  }
  if (out.length > max) return samplePoints(out.map((p) => [p.lng, p.lat] as LngLat), max).map(([lng, lat]) => ({ lat, lng }));
  return out;
}

/** Merge two sources; a Wikipedia hit within 300 m of an OSM place with the same-ish name is the same place. */
function merge(osm: Discovery[], wiki: Discovery[]) {
  const out = [...osm];
  for (const w of wiki) {
    const twin = out.find((o) => haversineKm(o, w) < 0.4 && (o.name.toLowerCase().includes(w.name.toLowerCase().split(',')[0]) || w.name.toLowerCase().includes(o.name.toLowerCase())));
    if (twin) {
      twin.summary ??= w.summary; twin.summarySource ??= w.summarySource; twin.imageUrl ??= w.imageUrl; twin.imageCredit ??= w.imageCredit; twin.wikiUrl ??= w.wikiUrl;
      twin.tags = { wikipedia: w.tags.wikipedia, ...twin.tags };
    } else out.push(w);
  }
  return out;
}

function buildQuery(cats: CategoryDef[], area: string, limit: number) {
  const parts = cats.flatMap((c) => c.selectors.map((s) => `nwr${s}["name"](${area});`));
  return `[out:json][timeout:25];(${parts.join('')});out center tags ${limit};`;
}

function toDiscovery(el: any, origin: { line?: LngLat[]; point?: { lat: number; lng: number } }, mode: Transport): Discovery | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null || !tags.name) return null;
  const cat = classify(tags);
  if (!cat) return null;
  const d = origin.line ? distanceToLineKm({ lat, lng }, origin.line).km : haversineKm(origin.point!, { lat, lng });
  return {
    placeId: `osm:${el.type}/${el.id}`,
    name: tags['name:en'] ?? tags.name,
    lat,
    lng,
    category: cat.key,
    categoryLabel: cat.label,
    tags,
    source: 'openstreetmap',
    distanceKm: d,
    detourMin: origin.line ? estimateDetourMin(d, mode) : estimateDetourMin(d / 2, mode),
    visitMin: cat.visitMin,
    openingHours: tags.opening_hours,
    score: 0,
  };
}

export interface DiscoveryQuery {
  interests: Interest[];
  mode: Transport;
  maxKm: number;
  dismissed?: string[];
  affinity?: Record<string, number>;
  limit?: number;
  categories?: string[];   // explicit override (assistant / quick filters)
}

/** Base relevance score (0-1) from data only: interest match, notability, distance, learned affinity. */
export function scoreDiscovery(d: Discovery, q: DiscoveryQuery) {
  const cat = categoryByKey[d.category];
  const match = cat ? cat.interests.filter((i) => q.interests.includes(i)).length : 0;
  const notable = (d.tags.wikipedia ? 0.25 : 0) + (d.tags.wikidata ? 0.1 : 0) + (d.tags.description ? 0.05 : 0);
  const near = 1 - Math.min(1, d.distanceKm / Math.max(1, q.maxKm));
  const aff = Math.max(-0.3, Math.min(0.3, (q.affinity?.[d.category] ?? 0) * 0.05));
  return Math.max(0, Math.min(1, 0.15 * match + notable + 0.3 * near + aff + 0.1));
}

function rank(list: Discovery[], q: DiscoveryQuery) {
  const dismissed = new Set(q.dismissed ?? []);
  const seen = new Set<string>();
  const out: Discovery[] = [];
  for (const d of list) {
    if (dismissed.has(d.placeId)) continue;
    const k = d.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    d.score = scoreDiscovery(d, q);
    out.push(d);
  }
  // Keep variety: no single category takes more than 40% of the list.
  out.sort((a, b) => b.score - a.score);
  const cap = Math.max(3, Math.ceil((q.limit ?? 30) * 0.4));
  const per: Record<string, number> = {};
  return out.filter((d) => (per[d.category] = (per[d.category] ?? 0) + 1) <= cap).slice(0, q.limit ?? 30);
}

/** Places along a route. Search corridor is capped so Overpass stays responsive. */
export async function discoverAlongRoute(line: LngLat[], q: DiscoveryQuery, signal?: AbortSignal): Promise<Discovery[]> {
  const cats = q.categories ? CATEGORY.filter((c) => q.categories!.includes(c.key)) : categoriesFor(q.interests);
  const radiusM = Math.round(Math.min(q.maxKm, 15) * 1000);
  const pts = samplePoints(line, 60);
  const area = `around:${radiusM},${pts.map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(',')}`;
  const wikiPts = pointsEvery(line, Math.max(8, Math.min(q.maxKm, 10) * 1.6), 30);
  const [osmRes, wikiRes] = await Promise.allSettled([
    overpass(buildQuery(cats, area, 400), signal, 18000).then((els) => els.map((e) => toDiscovery(e, { line }, q.mode)).filter(Boolean) as Discovery[]),
    pool(wikiPts, 6, (p) => wikiGeo(p, Math.min(q.maxKm, 10) * 1000, signal)).then((pages) =>
      pages.flat().filter(Boolean).map((pg) => wikiToDiscovery(pg, { line }, q.mode)).filter(Boolean) as Discovery[]),
  ]);
  if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  const osm = osmRes.status === 'fulfilled' ? osmRes.value : [];
  const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : [];
  if (osmRes.status === 'rejected' && wikiRes.status === 'rejected') throw new Error('Place search is unavailable right now');
  const wanted = new Set(cats.map((c) => c.key));
  return rank(merge(osm, wiki.filter((w) => wanted.has(w.category) || w.category === 'attraction')).filter((d) => d.distanceKm <= q.maxKm), q);
}

/** Places around a point (Near You, Find something nearby, the Guide). */
export async function discoverNearby(p: { lat: number; lng: number }, q: DiscoveryQuery, signal?: AbortSignal): Promise<Discovery[]> {
  const cats = q.categories ? CATEGORY.filter((c) => q.categories!.includes(c.key)) : categoriesFor(q.interests);
  const radiusM = Math.round(Math.min(q.maxKm, 40) * 1000);
  // Wikipedia geosearch caps at 10 km, so ring the point for wider searches.
  const r = Math.min(q.maxKm, 40);
  const ring = r <= 10 ? [p] : [p, ...[0, 60, 120, 180, 240, 300].map((deg) => {
    const k = r * 0.6, a = (deg * Math.PI) / 180;
    return { lat: p.lat + (k / 110.57) * Math.cos(a), lng: p.lng + (k / (111.32 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(a) };
  })];
  const [osmRes, wikiRes] = await Promise.allSettled([
    overpass(buildQuery(cats, `around:${radiusM},${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, 300), signal, 12000).then((els) => els.map((e) => toDiscovery(e, { point: p }, q.mode)).filter(Boolean) as Discovery[]),
    pool(ring, 6, (c) => wikiGeo(c, 10000, signal)).then((pages) => pages.flat().filter(Boolean).map((pg) => wikiToDiscovery(pg, { point: p }, q.mode)).filter(Boolean) as Discovery[]),
  ]);
  if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  if (osmRes.status === 'rejected' && wikiRes.status === 'rejected') throw new Error('Place search is unavailable right now');
  const osm = osmRes.status === 'fulfilled' ? osmRes.value : [];
  const wanted = new Set(cats.map((c) => c.key));
  const wiki = (wikiRes.status === 'fulfilled' ? wikiRes.value : []).filter((w) => wanted.has(w.category) || (!q.categories && w.category === 'attraction'));
  return rank(merge(osm, wiki).filter((d) => d.distanceKm <= Math.max(q.maxKm, 10)), q);
}

/** Adds Wikipedia summary + photo to the top results (in place). Unlinked places stay photo-less. */
export async function enrich(list: Discovery[], max = 18): Promise<Discovery[]> {
  await Promise.all(
    list.slice(0, max).map(async (d) => {
      if (d.tags.wikipedia && !d.summary) {
        const s = await wikiSummary(d.tags.wikipedia);
        if (s) {
          d.summary = s.extract;
          d.summarySource = 'wikipedia';
          d.wikiUrl = s.url;
          d.imageUrl = sizedThumb(s.thumb, 800) ?? s.image;
          d.imageCredit = d.imageUrl ? 'Wikimedia Commons' : undefined;
        }
      }
      if (!d.imageUrl && d.tags.wikidata) {
        const img = await wikidataImage(d.tags.wikidata);
        if (img) { d.imageUrl = img; d.imageCredit = 'Wikimedia Commons'; }
      }
      if (!d.imageUrl && d.tags.image?.startsWith('https://upload.wikimedia.org/')) {
        d.imageUrl = d.tags.image;
        d.imageCredit = 'Wikimedia Commons';
      }
    }),
  );
  // Places with a real photo and summary float up a little — they are better documented.
  for (const d of list) if (d.imageUrl) d.score = Math.min(1, d.score + 0.08);
  return list.sort((a, b) => b.score - a.score);
}

/** Map keywords in a free-text question to categories (used by the Guide and quick filters). */
export function categoriesForQuestion(q: string): string[] {
  const s = q.toLowerCase();
  const out = new Set<string>();
  const add = (...k: string[]) => k.forEach((x) => out.add(x));
  if (/sunset|sunrise|view|scenic|photo/.test(s)) add('viewpoint', 'lighthouse', 'beach', 'peak');
  if (/beach|swim|sand|coast/.test(s)) add('beach');
  if (/surf/.test(s)) add('surf', 'beach');
  if (/lunch|dinner|eat|food|coffee|cafe|breakfast|bakery|restaurant/.test(s)) add('food');
  if (/camp|tent|sleep|tonight|stay|hut/.test(s)) add('camp', 'hut');
  if (/hike|trail|walk/.test(s)) add('trailhead', 'park', 'peak', 'waterfall');
  if (/waterfall|falls/.test(s)) add('waterfall');
  if (/museum|art|gallery|rain/.test(s)) add('museum');
  if (/history|historic|castle|old|town/.test(s)) add('historic', 'town');
  if (/hot spring|spring/.test(s)) add('hotspring');
  if (!out.size) add('viewpoint', 'attraction', 'historic', 'waterfall', 'beach', 'town', 'lighthouse', 'museum');
  return [...out];
}
