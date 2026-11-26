// Editorial content: curated REAL places and routes. Names only — photos, summaries and
// coordinates are fetched live from Wikipedia (with credit) and geocoding, never hard-coded.
import type { Interest } from '@/data/types';

export const HERO_WIKI = 'Bixby Creek Bridge';

/** Discover hero: a calm, open sky on top (room for the headline), detail low in the frame. */
export const HERO = {
  uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Anse_Severe_-_La_Digue_-_Seychelles_-_06.jpg/1280px-Anse_Severe_-_La_Digue_-_Seychelles_-_06.jpg',
  place: 'Anse Sévère, La Digue, Seychelles',
  credit: 'NorbertNagel · CC BY-SA 4.0 · Wikimedia Commons',
  sky: '#2E9AE1', // sampled from the photo's top edge
};

export const EXPERIENCES: { key: string; title: string; wiki: string; interests: Interest[] }[] = [
  { key: 'coast', title: 'Wild coastlines', wiki: 'Big Sur', interests: ['beaches', 'scenic', 'photography'] },
  { key: 'mountains', title: 'Mountain roads', wiki: 'Tioga Pass', interests: ['scenic', 'hiking', 'adventure'] },
  { key: 'waterfalls', title: 'Waterfalls', wiki: 'McWay Falls', interests: ['nature', 'hiking', 'photography'] },
  { key: 'forests', title: 'Old forests', wiki: 'Redwood National and State Parks', interests: ['nature', 'hiking', 'camping'] },
  { key: 'towns', title: 'Small towns', wiki: 'Mendocino, California', interests: ['historic', 'food', 'local'] },
  { key: 'desert', title: 'Desert light', wiki: 'Joshua Tree National Park', interests: ['adventure', 'camping', 'photography'] },
];

export const UNEXPECTED: string[] = [
  'Glass Beach (Fort Bragg, California)',
  'Fern Canyon',
  'Bowling Ball Beach',
  'Hole-in-the-Wall (Mojave National Preserve)',
  'Montaña de Oro State Park',
  'Bodie, California',
  'Pinnacles National Park',
  'Lost Coast',
];

export const ROAD_TRIPS: { title: string; from: string; to: string; wiki: string; blurb: string; interests: Interest[] }[] = [
  { title: 'Pacific Coast Highway', from: 'San Francisco', to: 'Santa Barbara', wiki: 'California State Route 1', blurb: 'Cliffs, coves and the Big Sur coast.', interests: ['beaches', 'scenic', 'photography', 'food'] },
  { title: 'Blue Ridge Parkway', from: 'Waynesboro, Virginia', to: 'Asheville', wiki: 'Blue Ridge Parkway', blurb: 'Appalachian overlooks, mile after mile.', interests: ['scenic', 'hiking', 'nature'] },
  { title: 'Overseas Highway', from: 'Miami', to: 'Key West', wiki: 'Overseas Highway', blurb: 'Bridges over turquoise water.', interests: ['beaches', 'scenic', 'food'] },
  { title: 'Great Ocean Road', from: 'Torquay, Victoria', to: 'Warrnambool', wiki: 'Great Ocean Road', blurb: 'Limestone stacks on the Southern Ocean.', interests: ['beaches', 'scenic', 'surfing'] },
  { title: 'Iceland South Coast', from: 'Reykjavík', to: 'Vík í Mýrdal', wiki: 'Seljalandsfoss', blurb: 'Waterfalls, black sand, glaciers.', interests: ['nature', 'photography', 'adventure'] },
  { title: 'Going-to-the-Sun Road', from: 'West Glacier, Montana', to: 'St. Mary, Montana', wiki: 'Going-to-the-Sun Road', blurb: 'One alpine road across Glacier National Park.', interests: ['scenic', 'hiking', 'nature'] },
];

export const INSPIRATION: { wiki: string; kicker: string; line: string }[] = [
  { wiki: 'Lofoten', kicker: 'Norway', line: 'Fishing villages under granite peaks.' },
  { wiki: 'Dolomites', kicker: 'Italy', line: 'Pale towers, high passes, mountain huts.' },
  { wiki: 'Faroe Islands', kicker: 'North Atlantic', line: 'Grass roofs and sea cliffs at the edge of the map.' },
  { wiki: 'Torres del Paine National Park', kicker: 'Patagonia', line: 'Granite horns above glacial lakes.' },
];
