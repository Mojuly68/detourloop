// Domain types shared by the UI, services and both data backends.

export type LngLat = [number, number];

export interface Place {
  name: string;
  lat: number;
  lng: number;
  /** Secondary line, e.g. "California, United States". */
  context?: string;
}

export type Interest =
  | 'nature' | 'beaches' | 'scenic' | 'hiking' | 'camping' | 'surfing' | 'photography'
  | 'food' | 'historic' | 'architecture' | 'local' | 'adventure' | 'stays';

export type TravelStyle = 'relaxed' | 'adventurous' | 'spontaneous' | 'family' | 'romantic' | 'photography';
export type Transport = 'driving' | 'cycling' | 'walking';
export type Budget = 'shoestring' | 'moderate' | 'comfort' | 'luxury';
export type TripStatus = 'planned' | 'active' | 'completed';

export interface Route {
  coords: LngLat[];
  distanceM: number;
  durationS: number;
  /** Which service produced it — shown to the user. */
  source: 'mapbox' | 'osrm' | 'straight-line';
}

export interface Stop {
  id: string;
  placeId?: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  sequence: number;
  /** Minutes. Always an estimate. */
  visitMin?: number;
  status: 'planned' | 'visited' | 'skipped';
}

export interface Trip {
  id: string;
  title: string;
  origin: Place;
  destination?: Place;
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;
  days: number;
  status: TripStatus;
  transport: Transport;
  budget: Budget;
  interests: Interest[];
  style: TravelStyle;
  maxDetourKm: number;
  route?: Route;
  stops: Stop[];
  coverImage?: string;
  notes: TripNote[];
  createdAt: string;
  completedAt?: string;
}

export interface TripNote {
  id: string;
  text: string;
  at: string;
  lat?: number;
  lng?: number;
}

/** A real place found through a map data provider. */
export interface Discovery {
  placeId: string;          // "osm:node/123"
  name: string;
  lat: number;
  lng: number;
  category: string;         // internal key, see services/places CATEGORY
  categoryLabel: string;
  tags: Record<string, string>;
  source: 'openstreetmap' | 'wikipedia' | 'mapbox';
  /** km from the route (or from the user, for nearby searches). Computed, not estimated. */
  distanceKm: number;
  /** Extra travel minutes for a round trip off the route. Estimate until the route is recalculated. */
  detourMin: number;
  visitMin: number;         // estimate
  imageUrl?: string;
  imageCredit?: string;
  summary?: string;         // from Wikipedia when available
  summarySource?: 'wikipedia';
  wikiUrl?: string;
  openingHours?: string;    // only the OSM opening_hours tag, labelled "per OpenStreetMap"
  why?: string;
  whySource?: 'ai' | 'map-data';
  score: number;
}

export interface Media {
  id: string;
  tripId: string;
  stopId?: string;
  type: 'photo' | 'video';
  uri: string;              // local uri (demo) or signed URL (cloud)
  path?: string;            // storage path (cloud)
  capturedAt?: string;
  lat?: number;
  lng?: number;
  caption?: string;
  favorite: boolean;
  durationMs?: number;
}

export interface Replay {
  tripId: string;
  title: string;
  narrative: string;
  narrativeSource: 'ai' | 'template' | 'user';
  coverImage?: string;
  selectedMediaIds: string[];
  visibility: 'private' | 'unlisted' | 'public';
  shareUrl?: string;
  status: 'draft' | 'ready';
  /** Public numbers shown on the shared story. */
  stats?: { distance_km?: number; stops: number; photos: number; videos: number; days: number };
  createdAt: string;
}

export interface SavedPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  imageUrl?: string;
  savedAt: string;
}

export interface Preferences {
  interests: Interest[];
  style: TravelStyle;
  pace: 'slow' | 'balanced' | 'packed';
  budget: Budget;
  transport: Transport;
  stays: string[];
  maxDetourKm: number;
  favoriteDestinations: string[];
  /** How distances are shown. Stored values stay in km. Default miles. */
  units?: Units;
}

export type Units = 'mi' | 'km';

export interface Profile {
  id: string;
  displayName: string;
  email?: string;
  /** Cloud mode: a guest (anonymous) account that has not been linked to Sign in with Apple yet. */
  guest?: boolean;
  avatarUrl?: string;
  prefs: Preferences;
  /** If set by the user, overrides the computed personality. */
  personalityOverride?: string;
  plan: 'free' | 'plus' | 'annual';
  notifications: boolean;
  /** Category → affinity, learned from add / save / dismiss. */
  affinity: Record<string, number>;
  dismissed: string[];
  createdAt: string;
}
