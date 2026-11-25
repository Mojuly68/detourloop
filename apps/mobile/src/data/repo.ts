// Data access. One interface, two backends:
//   • CloudRepo  — Supabase (Postgres + RLS + Storage), used when EXPO_PUBLIC_SUPABASE_* are set.
//   • LocalRepo  — this device only (AsyncStorage / localStorage). Clearly labelled demo mode.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isCloud, config } from '@/services/config';
import { supabase } from '@/services/supabase';
import { DEFAULT_PREFS } from '@/services/personalization';
import type { Media, Profile, Replay, SavedPlace, Stop, Trip } from './types';

export const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export interface Repo {
  kind: 'cloud' | 'local';
  // auth
  currentUserId(): Promise<string | null>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  // profile
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  // trips
  listTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | null>;
  saveTrip(t: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  // media
  listMedia(tripId: string): Promise<Media[]>;
  addMedia(tripId: string, m: Omit<Media, 'id' | 'tripId'> & { mimeType?: string; file?: Blob | File }): Promise<Media>;
  updateMedia(m: Media): Promise<void>;
  deleteMedia(m: Media): Promise<void>;
  // replay & sharing
  getReplay(tripId: string): Promise<Replay | null>;
  saveReplay(r: Replay): Promise<void>;
  /** Returns a share URL, or null when sharing cannot work (demo mode). */
  share(tripId: string, visibility: 'unlisted' | 'public'): Promise<string | null>;
  revokeShare(tripId: string): Promise<void>;
  // saved places
  listSaved(): Promise<SavedPlace[]>;
  savePlace(p: SavedPlace): Promise<void>;
  unsavePlace(placeId: string): Promise<void>;
  // account
  exportAll(): Promise<unknown>;
  deleteAccount(): Promise<void>;
}

// ─────────────────────────────────── LocalRepo ───────────────────────────────────
const K = { profile: 'detour.profile', trips: 'detour.trips', media: 'detour.media', replays: 'detour.replays', saved: 'detour.saved' };
async function read<T>(k: string, d: T): Promise<T> {
  try { const s = await AsyncStorage.getItem(k); return s ? (JSON.parse(s) as T) : d; } catch { return d; }
}
const write = (k: string, v: unknown) => AsyncStorage.setItem(k, JSON.stringify(v));

export const LocalRepo: Repo = {
  kind: 'local',
  async currentUserId() { return (await read<Profile | null>(K.profile, null))?.id ?? null; },
  async signUp(email, _password, name) {
    // Demo mode: no server, so no password is stored. The profile lives on this device only.
    const p: Profile = {
      id: uid(), displayName: name || email.split('@')[0] || 'Traveller', email: email || undefined, prefs: DEFAULT_PREFS,
      plan: 'free', notifications: false, affinity: {}, dismissed: [], createdAt: new Date().toISOString(),
    };
    await write(K.profile, p);
  },
  async signIn(email, password) { return this.signUp(email, password, ''); },
  async signOut() { await AsyncStorage.removeItem(K.profile); },
  getProfile: () => read<Profile | null>(K.profile, null),
  saveProfile: (p) => write(K.profile, p),
  async listTrips() { return (await read<Trip[]>(K.trips, [])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async getTrip(id) { return (await read<Trip[]>(K.trips, [])).find((t) => t.id === id) ?? null; },
  async saveTrip(t) {
    const all = await read<Trip[]>(K.trips, []);
    const i = all.findIndex((x) => x.id === t.id);
    if (i >= 0) all[i] = t; else all.push(t);
    await write(K.trips, all);
  },
  async deleteTrip(id) {
    await write(K.trips, (await read<Trip[]>(K.trips, [])).filter((t) => t.id !== id));
    await write(K.media, (await read<Media[]>(K.media, [])).filter((m) => m.tripId !== id));
    await write(K.replays, (await read<Replay[]>(K.replays, [])).filter((r) => r.tripId !== id));
  },
  async listMedia(tripId) {
    return (await read<Media[]>(K.media, [])).filter((m) => m.tripId === tripId).sort((a, b) => (a.capturedAt ?? '').localeCompare(b.capturedAt ?? ''));
  },
  async addMedia(tripId, m) {
    let uri = m.uri;
    // On web, blob: URLs die with the tab — store small images as data URLs so the demo survives a reload.
    if (Platform.OS === 'web' && uri.startsWith('blob:') && m.type === 'photo') {
      try { uri = await downscaleToDataUrl(uri, 1280); } catch {}
    }
    const media: Media = { id: uid(), tripId, type: m.type, uri, capturedAt: m.capturedAt, lat: m.lat, lng: m.lng, caption: m.caption, favorite: m.favorite, stopId: m.stopId, durationMs: m.durationMs };
    const all = await read<Media[]>(K.media, []);
    all.push(media);
    try { await write(K.media, all); } catch { throw new Error('This device is out of demo storage. Connect Supabase to store media in the cloud.'); }
    return media;
  },
  async updateMedia(m) {
    const all = await read<Media[]>(K.media, []);
    await write(K.media, all.map((x) => (x.id === m.id ? m : x)));
  },
  async deleteMedia(m) { await write(K.media, (await read<Media[]>(K.media, [])).filter((x) => x.id !== m.id)); },
  async getReplay(tripId) { return (await read<Replay[]>(K.replays, [])).find((r) => r.tripId === tripId) ?? null; },
  async saveReplay(r) {
    const all = (await read<Replay[]>(K.replays, [])).filter((x) => x.tripId !== r.tripId);
    all.push(r);
    await write(K.replays, all);
  },
  async share() { return null; },
  async revokeShare() {},
  listSaved: () => read<SavedPlace[]>(K.saved, []),
  async savePlace(p) { const all = (await read<SavedPlace[]>(K.saved, [])).filter((x) => x.placeId !== p.placeId); all.unshift(p); await write(K.saved, all); },
  async unsavePlace(id) { await write(K.saved, (await read<SavedPlace[]>(K.saved, [])).filter((x) => x.placeId !== id)); },
  async exportAll() {
    return { exported_at: new Date().toISOString(), mode: 'demo (this device)', profile: await read(K.profile, null), trips: await read(K.trips, []), media: (await read<Media[]>(K.media, [])).map((m) => ({ ...m, uri: m.uri.startsWith('data:') ? '[embedded image omitted]' : m.uri })), replays: await read(K.replays, []), saved: await read(K.saved, []) };
  },
  async deleteAccount() { await AsyncStorage.multiRemove(Object.values(K)); },
};

async function downscaleToDataUrl(src: string, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = (globalThis as any).document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ─────────────────────────────────── CloudRepo ───────────────────────────────────
// Maps the client model onto the tables in supabase/migrations. RLS enforces ownership server-side;
// the user_id filters here are for clarity, not security.
const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
};
async function me() {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user;
}

const tripRow = (t: Trip, userId: string) => ({
  id: t.id, user_id: userId, title: t.title, origin: t.origin, destination: t.destination ?? null,
  start_date: t.startDate ?? null, end_date: t.endDate ?? null, status: t.status, transport_mode: t.transport,
  budget: t.budget, interests: t.interests, travel_style: t.style, max_detour_km: t.maxDetourKm,
  route_geometry: t.route ? { type: 'LineString', coordinates: t.route.coords, source: t.route.source } : null,
  route_distance_m: t.route?.distanceM ?? null, route_duration_s: t.route?.durationS ?? null,
  cover_image: t.coverImage ?? null, notes: JSON.stringify(t.notes ?? []),
});

function rowToTrip(r: any, stops: any[]): Trip {
  const days = r.start_date && r.end_date ? Math.round((+new Date(r.end_date) - +new Date(r.start_date)) / 86400000) + 1 : 1;
  let notes = [];
  try { notes = r.notes ? JSON.parse(r.notes) : []; } catch {}
  return {
    id: r.id, title: r.title, origin: r.origin, destination: r.destination ?? undefined, startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined, days, status: r.status === 'saved' ? 'planned' : r.status, transport: r.transport_mode,
    budget: r.budget ?? 'moderate', interests: r.interests ?? [], style: r.travel_style ?? 'spontaneous',
    maxDetourKm: Number(r.max_detour_km), coverImage: r.cover_image ?? undefined, notes, createdAt: r.created_at,
    route: r.route_geometry ? { coords: r.route_geometry.coordinates, distanceM: Number(r.route_distance_m), durationS: Number(r.route_duration_s), source: r.route_geometry.source ?? 'osrm' } : undefined,
    stops: stops.sort((a, b) => a.sequence - b.sequence).map((s) => ({
      id: s.id, placeId: s.place_id ?? undefined, name: s.name, lat: s.latitude, lng: s.longitude, category: s.category ?? undefined,
      description: s.description ?? undefined, imageUrl: s.image_url ?? undefined, sequence: s.sequence, visitMin: s.estimated_visit_duration ?? undefined, status: s.status,
    })),
  };
}

const stopRow = (s: Stop, tripId: string) => ({
  id: s.id, trip_id: tripId, place_id: s.placeId ?? null, name: s.name, latitude: s.lat, longitude: s.lng, category: s.category ?? null,
  description: s.description ?? null, image_url: s.imageUrl ?? null, sequence: s.sequence, estimated_visit_duration: s.visitMin ?? null, status: s.status,
});

async function signed(path: string) {
  const { data } = await sb().storage.from('trip-media').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? '';
}

export const CloudRepo: Repo = {
  kind: 'cloud',
  async currentUserId() { const { data } = await sb().auth.getSession(); return data.session?.user.id ?? null; },
  async signUp(email, password, name) {
    const { error } = await sb().auth.signUp({ email, password, options: { data: { display_name: name } } });
    if (error) throw error;
  },
  async signIn(email, password) {
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signOut() { await sb().auth.signOut(); },
  async getProfile() {
    const u = await me();
    const { data } = await sb().from('profiles').select('*').eq('id', u.id).maybeSingle();
    if (!data) return null;
    const tp = data.travel_preferences ?? {};
    const { data: dis } = await sb().from('dismissed_places').select('place_id');
    return {
      id: data.id, displayName: data.display_name ?? '', email: data.email ?? u.email, avatarUrl: data.avatar_url ?? undefined,
      prefs: { ...DEFAULT_PREFS, ...(tp.prefs ?? {}) }, personalityOverride: tp.personalityOverride, affinity: tp.affinity ?? {},
      notifications: Boolean(tp.notifications), plan: data.subscription_status, dismissed: (dis ?? []).map((d: any) => d.place_id), createdAt: data.created_at,
    };
  },
  async saveProfile(p) {
    await sb().from('profiles').update({
      display_name: p.displayName, avatar_url: p.avatarUrl ?? null, travel_style: p.prefs.style,
      travel_preferences: { prefs: p.prefs, affinity: p.affinity, personalityOverride: p.personalityOverride, notifications: p.notifications },
    }).eq('id', p.id);
    if (p.dismissed.length) {
      await sb().from('dismissed_places').upsert(p.dismissed.slice(-200).map((id) => ({ user_id: p.id, place_id: id })), { ignoreDuplicates: true });
    }
  },
  async listTrips() {
    const { data, error } = await sb().from('trips').select('*, trip_stops(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => rowToTrip(r, r.trip_stops ?? []));
  },
  async getTrip(id) {
    const { data } = await sb().from('trips').select('*, trip_stops(*)').eq('id', id).maybeSingle();
    return data ? rowToTrip(data, data.trip_stops ?? []) : null;
  },
  async saveTrip(t) {
    const u = await me();
    const { error } = await sb().from('trips').upsert(tripRow(t, u.id));
    if (error) throw error;
    // Replace stops atomically enough for an MVP: upsert current, delete removed.
    const ids = t.stops.map((s) => s.id);
    if (t.stops.length) {
      const { error: e2 } = await sb().from('trip_stops').upsert(t.stops.map((s) => stopRow(s, t.id)));
      if (e2) throw e2;
    }
    let del = sb().from('trip_stops').delete().eq('trip_id', t.id);
    if (ids.length) del = del.not('id', 'in', `(${ids.join(',')})`);
    await del;
  },
  async deleteTrip(id) {
    const u = await me();
    const { data: files } = await sb().storage.from('trip-media').list(`${u.id}/${id}`);
    if (files?.length) await sb().storage.from('trip-media').remove(files.map((f) => `${u.id}/${id}/${f.name}`));
    const { error } = await sb().from('trips').delete().eq('id', id);
    if (error) throw error;
  },
  async listMedia(tripId) {
    const { data } = await sb().from('trip_media').select('*').eq('trip_id', tripId).order('captured_at');
    return Promise.all((data ?? []).map(async (r: any) => ({
      id: r.id, tripId, stopId: r.stop_id ?? undefined, type: r.media_type, path: r.media_url, uri: await signed(r.media_url),
      capturedAt: r.captured_at ?? undefined, lat: r.latitude ?? undefined, lng: r.longitude ?? undefined, caption: r.caption ?? undefined, favorite: r.is_favorite,
    })));
  },
  async addMedia(tripId, m) {
    const u = await me();
    const id = uid();
    const ext = m.type === 'video' ? 'mp4' : 'jpg';
    const path = `${u.id}/${tripId}/${id}.${ext}`;
    const body = m.file ?? (await (await fetch(m.uri)).blob());
    const { error } = await sb().storage.from('trip-media').upload(path, body, { contentType: m.mimeType ?? (m.type === 'video' ? 'video/mp4' : 'image/jpeg') });
    if (error) throw error;
    const row = { id, trip_id: tripId, user_id: u.id, media_type: m.type, media_url: path, captured_at: m.capturedAt ?? null, latitude: m.lat ?? null, longitude: m.lng ?? null, caption: m.caption ?? null, is_favorite: m.favorite, stop_id: m.stopId ?? null };
    const { error: e2 } = await sb().from('trip_media').insert(row);
    if (e2) throw e2;
    return { id, tripId, type: m.type, path, uri: await signed(path), capturedAt: m.capturedAt, lat: m.lat, lng: m.lng, caption: m.caption, favorite: m.favorite, stopId: m.stopId };
  },
  async updateMedia(m) {
    await sb().from('trip_media').update({ caption: m.caption ?? null, is_favorite: m.favorite, captured_at: m.capturedAt ?? null, stop_id: m.stopId ?? null, latitude: m.lat ?? null, longitude: m.lng ?? null }).eq('id', m.id);
  },
  async deleteMedia(m) {
    if (m.path) await sb().storage.from('trip-media').remove([m.path]);
    await sb().from('trip_media').delete().eq('id', m.id);
  },
  async getReplay(tripId) {
    const { data } = await sb().from('replays').select('*').eq('trip_id', tripId).maybeSingle();
    if (!data) return null;
    const { data: share } = await sb().from('shared_trips').select('share_token').eq('trip_id', tripId).eq('revoked', false).maybeSingle();
    return {
      tripId, title: data.title, narrative: data.narrative ?? '', narrativeSource: data.narrative_source, coverImage: data.cover_image ?? undefined,
      selectedMediaIds: data.selected_media_ids ?? [], visibility: data.visibility, stats: data.stats ?? undefined, status: data.status === 'ready' ? 'ready' : 'draft', createdAt: data.created_at,
      shareUrl: share && config.webUrl ? `${config.webUrl}/r/${share.share_token}` : undefined,
    };
  },
  async saveReplay(r) {
    const u = await me();
    const { error } = await sb().from('replays').upsert({
      trip_id: r.tripId, user_id: u.id, title: r.title, narrative: r.narrative, narrative_source: r.narrativeSource,
      cover_image: r.coverImage ?? null, selected_media_ids: r.selectedMediaIds, visibility: r.visibility, status: r.status, stats: r.stats ?? {},
    }, { onConflict: 'trip_id' });
    if (error) throw error;
  },
  async share(tripId, visibility) {
    const u = await me();
    if (!config.webUrl) throw new Error('Set EXPO_PUBLIC_WEB_URL to the deployed web app to create share links.');
    await sb().from('replays').update({ visibility }).eq('trip_id', tripId);
    const { data: existing } = await sb().from('shared_trips').select('*').eq('trip_id', tripId).eq('revoked', false).maybeSingle();
    if (existing) {
      await sb().from('shared_trips').update({ visibility }).eq('id', existing.id);
      return `${config.webUrl}/r/${existing.share_token}`;
    }
    const { data, error } = await sb().from('shared_trips').insert({ trip_id: tripId, owner_id: u.id, visibility }).select().single();
    if (error) throw error;
    return `${config.webUrl}/r/${data.share_token}`;
  },
  async revokeShare(tripId) {
    await sb().from('shared_trips').update({ revoked: true }).eq('trip_id', tripId);
    await sb().from('replays').update({ visibility: 'private' }).eq('trip_id', tripId);
  },
  async listSaved() {
    const { data } = await sb().from('favorites').select('*').order('created_at', { ascending: false });
    return (data ?? []).map((f: any) => ({ placeId: f.place_id, ...f.place, savedAt: f.created_at }));
  },
  async savePlace(p) {
    const u = await me();
    const { placeId, savedAt, ...place } = p;
    await sb().from('favorites').upsert({ user_id: u.id, place_id: placeId, place }, { onConflict: 'user_id,place_id' });
  },
  async unsavePlace(id) { await sb().from('favorites').delete().eq('place_id', id); },
  async exportAll() {
    const [profile, trips, media, replays, saved] = await Promise.all([
      this.getProfile(), this.listTrips(), sb().from('trip_media').select('*'), sb().from('replays').select('*'), this.listSaved(),
    ]);
    return { exported_at: new Date().toISOString(), profile, trips, media: media.data, replays: replays.data, saved };
  },
  async deleteAccount() {
    const u = await me();
    const { data: dirs } = await sb().storage.from('trip-media').list(u.id);
    for (const d of dirs ?? []) {
      const { data: files } = await sb().storage.from('trip-media').list(`${u.id}/${d.name}`);
      if (files?.length) await sb().storage.from('trip-media').remove(files.map((f) => `${u.id}/${d.name}/${f.name}`));
    }
    const { error } = await sb().rpc('delete_my_account');
    if (error) throw error;
    await sb().auth.signOut();
  },
};

export const repo: Repo = isCloud ? CloudRepo : LocalRepo;
