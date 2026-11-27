// PersonalizationService: learns from what the traveller adds, saves and dismisses, and
// derives a travel personality from stated preferences + behaviour. The user can override it.
import type { Interest, Preferences, Profile } from '@/data/types';

export const PERSONALITIES: Record<string, { title: string; line: string; icon: string }> = {
  explorer: { title: 'The Explorer', line: 'You want to see what is around the next bend, and the one after that.', icon: 'compass-outline' },
  scenic: { title: 'The Scenic Seeker', line: 'Viewpoints, coastlines and golden hour: you travel for the light.', icon: 'aperture-outline' },
  spontaneous: { title: 'The Spontaneous Traveler', line: 'Plans are a starting point. The detour is the point.', icon: 'shuffle-outline' },
  adventure: { title: 'The Adventure Hunter', line: 'Trailheads, summits and the long way round.', icon: 'flame-outline' },
  culture: { title: 'The Culture Collector', line: 'Old towns, local tables and stories with a past.', icon: 'library-outline' },
  slow: { title: 'The Slow Traveler', line: 'Fewer places, longer stays, nothing rushed.', icon: 'cafe-outline' },
};

const AFFINITY_TO_TRAIT: Record<string, keyof typeof PERSONALITIES> = {
  viewpoint: 'scenic', beach: 'scenic', lighthouse: 'scenic', waterfall: 'scenic',
  peak: 'adventure', trailhead: 'adventure', climbing: 'adventure', cave: 'adventure', camp: 'adventure', surf: 'adventure',
  historic: 'culture', museum: 'culture', town: 'culture', food: 'culture',
  park: 'explorer', attraction: 'explorer', hut: 'explorer', hotspring: 'slow',
};

const INTEREST_TO_TRAIT: Partial<Record<Interest, keyof typeof PERSONALITIES>> = {
  scenic: 'scenic', photography: 'scenic', beaches: 'scenic',
  hiking: 'adventure', adventure: 'adventure', camping: 'adventure', surfing: 'adventure',
  historic: 'culture', architecture: 'culture', food: 'culture', local: 'culture',
  nature: 'explorer', stays: 'slow',
};

export function computePersonality(prefs: Preferences, affinity: Record<string, number>) {
  const score: Record<string, number> = {};
  const bump = (k: string, v: number) => (score[k] = (score[k] ?? 0) + v);
  prefs.interests.forEach((i) => INTEREST_TO_TRAIT[i] && bump(INTEREST_TO_TRAIT[i]!, 1));
  Object.entries(affinity).forEach(([cat, v]) => AFFINITY_TO_TRAIT[cat] && bump(AFFINITY_TO_TRAIT[cat], v * 0.5));
  if (prefs.style === 'spontaneous') bump('spontaneous', 2.5);
  if (prefs.style === 'adventurous') bump('adventure', 1.5);
  if (prefs.style === 'photography') bump('scenic', 1.5);
  if (prefs.style === 'relaxed' || prefs.pace === 'slow') bump('slow', 2);
  if (prefs.maxDetourKm >= 40) bump('explorer', 1);
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'explorer';
  return best as keyof typeof PERSONALITIES;
}

export function personalityOf(p: Profile) {
  const key = (p.personalityOverride && PERSONALITIES[p.personalityOverride] ? p.personalityOverride : computePersonality(p.prefs, p.affinity)) as keyof typeof PERSONALITIES;
  return { key, ...PERSONALITIES[key], overridden: Boolean(p.personalityOverride) };
}

export function learn(p: Profile, category: string | undefined, signal: 'add' | 'save' | 'dismiss'): Profile['affinity'] {
  if (!category) return p.affinity;
  const delta = signal === 'add' ? 1 : signal === 'save' ? 0.6 : -0.8;
  return { ...p.affinity, [category]: Math.max(-6, Math.min(6, (p.affinity[category] ?? 0) + delta)) };
}

export const DEFAULT_PREFS: Preferences = {
  interests: ['scenic', 'nature', 'food'],
  style: 'spontaneous',
  pace: 'balanced',
  budget: 'moderate',
  transport: 'driving',
  stays: [],
  maxDetourKm: 16.1, // 10 miles
  favoriteDestinations: [],
  units: 'mi',
};
