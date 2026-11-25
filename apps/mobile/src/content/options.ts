import type { Budget, Interest, Transport, TravelStyle } from '@/data/types';

export const INTERESTS: { key: Interest; label: string; icon: string }[] = [
  { key: 'nature', label: 'Nature', icon: 'leaf-outline' },
  { key: 'beaches', label: 'Beaches', icon: 'sunny-outline' },
  { key: 'scenic', label: 'Scenic drives', icon: 'car-sport-outline' },
  { key: 'hiking', label: 'Hiking', icon: 'walk-outline' },
  { key: 'camping', label: 'Camping', icon: 'bonfire-outline' },
  { key: 'surfing', label: 'Surfing', icon: 'boat-outline' },
  { key: 'photography', label: 'Photography', icon: 'camera-outline' },
  { key: 'food', label: 'Food', icon: 'restaurant-outline' },
  { key: 'historic', label: 'Historic towns', icon: 'library-outline' },
  { key: 'architecture', label: 'Architecture', icon: 'business-outline' },
  { key: 'local', label: 'Local experiences', icon: 'people-outline' },
  { key: 'adventure', label: 'Adventure', icon: 'flame-outline' },
  { key: 'stays', label: 'Unique stays', icon: 'home-outline' },
];

export const STYLES: { key: TravelStyle; label: string; line: string; icon: string }[] = [
  { key: 'relaxed', label: 'Relaxed', line: 'Fewer stops, longer lingers', icon: 'cafe-outline' },
  { key: 'adventurous', label: 'Adventurous', line: 'Trails, summits, the long way', icon: 'flame-outline' },
  { key: 'spontaneous', label: 'Spontaneous', line: 'Leave room for surprises', icon: 'shuffle-outline' },
  { key: 'family', label: 'Family-friendly', line: 'Easy stops everyone enjoys', icon: 'people-outline' },
  { key: 'romantic', label: 'Romantic', line: 'Views, sunsets, good tables', icon: 'heart-outline' },
  { key: 'photography', label: 'Photography', line: 'Chase the light', icon: 'aperture-outline' },
];

export const TRANSPORT: { key: Transport; label: string; icon: string }[] = [
  { key: 'driving', label: 'Drive', icon: 'car-outline' },
  { key: 'cycling', label: 'Cycle', icon: 'bicycle-outline' },
  { key: 'walking', label: 'Walk', icon: 'walk-outline' },
];

export const BUDGETS: { key: Budget; label: string; sign: string }[] = [
  { key: 'shoestring', label: 'Shoestring', sign: '$' },
  { key: 'moderate', label: 'Moderate', sign: '$$' },
  { key: 'comfort', label: 'Comfort', sign: '$$$' },
  { key: 'luxury', label: 'Luxury', sign: '$$$$' },
];

/** Short glyph for discovery map markers. */
export const CATEGORY_GLYPH: Record<string, string> = {
  viewpoint: '◉', beach: '≈', waterfall: '⌇', peak: '▲', park: '❦', trailhead: '⟿', camp: '⛺', hut: '⌂', surf: '∿',
  food: '◆', town: '◼', historic: '♜', lighthouse: '✦', museum: '▣', attraction: '✶', cave: '◗', climbing: '⋀', hotspring: '♨',
};
