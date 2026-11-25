// AI services (client side). Every call goes through the `ai` Supabase Edge Function, which
// holds the OpenAI key. When the backend or AI is not configured, each service returns a
// deterministic result built from real data and marks it `source: 'map-data' | 'template'`,
// so the UI can label it — demo output is never presented as AI.
//
//   DiscoveryService.explain     → why each real place suits this traveller
//   ReplayStoryService.write     → factual narrative from actual trip data
//   TravelAssistantService.ask   → answers grounded in nearby real places
//   PersonalizationService       → see services/personalization.ts (local, data-driven)
import type { Discovery, Interest, Media, Trip } from '@/data/types';
import { isCloud } from './config';
import { callFunction, supabase } from './supabase';
import { categoryByKey } from './places';
import { fmtKm, fmtMin } from './geo';

async function aiAvailable() {
  if (!isCloud || !supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

const INTEREST_WORD: Record<Interest, string> = {
  nature: 'nature', beaches: 'beaches', scenic: 'scenic drives', hiking: 'hiking', camping: 'camping', surfing: 'surfing',
  photography: 'photography', food: 'local food', historic: 'historic towns', architecture: 'architecture',
  local: 'local experiences', adventure: 'adventure', stays: 'unique stays',
};

// ── DiscoveryService ───────────────────────────────────────────────────────
function templateWhy(d: Discovery, interests: Interest[]): string {
  const cat = categoryByKey[d.category];
  const hits = cat ? cat.interests.filter((i) => interests.includes(i)).map((i) => INTEREST_WORD[i]) : [];
  const bits: string[] = [];
  bits.push(hits.length ? `${d.categoryLabel} · fits your interest in ${hits.slice(0, 2).join(' and ')}` : d.categoryLabel);
  if (d.tags.description && d.source === 'wikipedia') bits.push(d.tags.description.charAt(0).toLowerCase() + d.tags.description.slice(1));
  bits.push(`${fmtKm(d.distanceKm)} off your way`);
  if (d.tags.wikipedia) bits.push('has its own Wikipedia article');
  if (d.tags.ele && d.category === 'peak') bits.push(`${d.tags.ele} m high per OpenStreetMap`);
  if (d.tags.fee === 'no') bits.push('marked free to visit');
  if (d.tags.drinking_water === 'yes') bits.push('drinking water listed');
  return bits.join(' · ') + '.';
}

export const DiscoveryService = {
  async explain(list: Discovery[], ctx: { interests: Interest[]; style: string; tripTitle?: string }) {
    for (const d of list) { d.why = templateWhy(d, ctx.interests); d.whySource = 'map-data'; }
    if (!(await aiAvailable()) || !list.length) return { list, source: 'map-data' as const };
    try {
      const top = list.slice(0, 12);
      const res = await callFunction<{ result: { items: { place_id: string; why: string; score: number }[] } }>('ai', {
        task: 'explain_discoveries',
        input: {
          traveller: { interests: ctx.interests, style: ctx.style },
          trip: ctx.tripTitle,
          places: top.map((d) => ({
            place_id: d.placeId, name: d.name, category: d.categoryLabel, distance_from_route_km: +d.distanceKm.toFixed(1),
            wikipedia_summary: d.summary?.slice(0, 400),
            tags: Object.fromEntries(Object.entries(d.tags).filter(([k]) => !k.startsWith('name:') && !k.startsWith('addr:')).slice(0, 20)),
          })),
        },
      });
      const byId = new Map(res.result.items.map((i) => [i.place_id, i]));
      for (const d of top) {
        const hit = byId.get(d.placeId);
        if (hit) { d.why = hit.why; d.whySource = 'ai'; d.score = 0.5 * d.score + 0.5 * Math.max(0, Math.min(1, hit.score)); }
      }
      list.sort((a, b) => b.score - a.score);
      return { list, source: 'ai' as const };
    } catch (e) {
      console.warn('AI explain failed; keeping map-data explanations', e);
      return { list, source: 'map-data' as const };
    }
  },
};

// ── ReplayStoryService ─────────────────────────────────────────────────────
const fmtDate = (s?: string) => (s ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : undefined);

export function templateStory(trip: Trip, media: Media[]): { title: string; story: string } {
  const visited = trip.stops.filter((s) => s.status !== 'skipped');
  const names = visited.map((s) => s.name);
  const km = trip.route ? Math.round(trip.route.distanceM / 1000) : undefined;
  const start = fmtDate(trip.startDate);
  const p1 = `Your journey began in ${trip.origin.name}${start ? ` on ${start}` : ''}` +
    (trip.destination ? ` and led to ${trip.destination.name}` : '') + (km ? `, ${km.toLocaleString()} km in all.` : '.');
  const p2 = names.length
    ? `Along the way you stopped at ${names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]}.`
    : 'You kept this one simple, with no planned stops in between.';
  const captions = media.filter((m) => m.caption).slice(0, 3).map((m) => `“${m.caption}”`);
  const favs = media.filter((m) => m.favorite).length;
  const p3 = media.length
    ? `You brought back ${media.filter((m) => m.type === 'photo').length} photos and ${media.filter((m) => m.type === 'video').length} videos${favs ? `, ${favs} of them favourites` : ''}.` + (captions.length ? ` In your own words: ${captions.join(' ')}` : '')
    : '';
  const notes = trip.notes.slice(0, 2).map((n) => n.text).filter(Boolean);
  const p4 = notes.length ? `From your notes: ${notes.join(' — ')}` : '';
  return {
    title: trip.destination ? `${trip.origin.name} to ${trip.destination.name}` : trip.title,
    story: [p1, p2, p3, p4].filter(Boolean).join('\n\n'),
  };
}

export const ReplayStoryService = {
  async write(trip: Trip, media: Media[]): Promise<{ title: string; story: string; source: 'ai' | 'template' }> {
    const fallback = templateStory(trip, media);
    if (!(await aiAvailable())) return { ...fallback, source: 'template' };
    try {
      const res = await callFunction<{ result: { title: string; story: string } }>('ai', {
        task: 'replay_story',
        input: {
          origin: trip.origin.name, destination: trip.destination?.name, start_date: trip.startDate, end_date: trip.endDate,
          distance_km: trip.route ? Math.round(trip.route.distanceM / 1000) : null,
          stops: trip.stops.filter((s) => s.status !== 'skipped').map((s) => ({ name: s.name, category: s.category })),
          captions: media.map((m) => m.caption).filter(Boolean),
          notes: trip.notes.map((n) => n.text),
          photo_count: media.filter((m) => m.type === 'photo').length,
          video_count: media.filter((m) => m.type === 'video').length,
        },
      });
      return { ...res.result, source: 'ai' };
    } catch (e) {
      console.warn('AI story failed; using template', e);
      return { ...fallback, source: 'template' };
    }
  },
};

// ── TravelAssistantService ─────────────────────────────────────────────────
export const TravelAssistantService = {
  async ask(question: string, candidates: Discovery[]): Promise<{ answer: string; places: Discovery[]; source: 'ai' | 'map-data' }> {
    const top = candidates.slice(0, 15);
    const demo = () => {
      const picks = top.slice(0, 4);
      return {
        answer: picks.length
          ? `Here ${picks.length === 1 ? 'is one place' : `are ${picks.length} places`} from map data near you that fit. Distances are straight-line; detour times are estimates.`
          : 'I could not find a matching place in OpenStreetMap near you. Try widening the distance or asking for something else.',
        places: picks,
        source: 'map-data' as const,
      };
    };
    if (!(await aiAvailable()) || !top.length) return demo();
    try {
      const res = await callFunction<{ result: { answer: string; place_ids: string[] } }>('ai', {
        task: 'assistant',
        input: {
          question,
          candidates: top.map((d) => ({ place_id: d.placeId, name: d.name, category: d.categoryLabel, distance_km: +d.distanceKm.toFixed(1), est_extra_minutes: d.detourMin, summary: d.summary?.slice(0, 240), opening_hours_osm: d.openingHours })),
        },
      });
      const ids = new Set(res.result.place_ids);
      return { answer: res.result.answer, places: top.filter((d) => ids.has(d.placeId)), source: 'ai' };
    } catch {
      return demo();
    }
  },
};

export const detourLabel = (d: Discovery) => `+${fmtMin(d.detourMin)} est.`;
