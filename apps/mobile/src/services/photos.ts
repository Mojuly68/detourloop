// Real, licensed imagery and summaries from Wikipedia / Wikimedia Commons (CC BY-SA / public domain).
// Every image carries a credit line. If a place has no Wikipedia/Wikidata link, it gets no photo —
// the UI shows a designed placeholder instead of an unrelated stock image.

export interface WikiSummary {
  title: string;
  extract?: string;
  thumb?: string;
  image?: string;       // larger original
  lat?: number;
  lng?: number;
  url: string;
  credit: string;
}

const cache = new Map<string, Promise<WikiSummary | null>>();

/** `ref` is a Wikipedia title ("Big Sur") or an OSM wikipedia tag ("en:Big Sur"). */
export function wikiSummary(ref: string): Promise<WikiSummary | null> {
  if (cache.has(ref)) return cache.get(ref)!;
  const p = (async () => {
    const m = ref.match(/^([a-z-]{2,12}):(.+)$/);
    const lang = m ? m[1] : 'en';
    const title = (m ? m[2] : ref).trim().replace(/ /g, '_');
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`);
      if (!r.ok) return null;
      const j = await r.json();
      if (j.type === 'disambiguation') return null;
      return {
        title: j.title,
        extract: j.extract,
        thumb: j.thumbnail?.source,
        image: j.originalimage?.source,
        lat: j.coordinates?.lat,
        lng: j.coordinates?.lon,
        url: j.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${title}`,
        credit: 'Photo & text: Wikipedia / Wikimedia Commons',
      } as WikiSummary;
    } catch {
      return null;
    }
  })();
  cache.set(ref, p);
  return p;
}

/** Image for a Wikidata item (property P18) via Commons. */
export async function wikidataImage(qid: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    if (!r.ok) return null;
    const j = await r.json();
    const file = j.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!file) return null;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=960`;
  } catch {
    return null;
  }
}

/** Wikimedia only serves thumbnails at standard widths; other widths fail. */
const BUCKETS = [120, 250, 330, 500, 960, 1280, 1920];

/** Resize a Wikipedia thumbnail URL (/NNNpx-File.jpg) to the nearest standard width ≥ `width`. */
export function sizedThumb(url: string | undefined, width: number) {
  if (!url) return url;
  const w = BUCKETS.find((b) => b >= width) ?? 1920;
  return url.replace(/\/(\d+)px-/, `/${w}px-`);
}

/** Fallback when a resized thumb fails (e.g. the original is smaller than the bucket). */
export function smallerThumb(url: string) {
  return /\/\d+px-/.test(url) ? url.replace(/\/(\d+)px-/, '/500px-') : null;
}
