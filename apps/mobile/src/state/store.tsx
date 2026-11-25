// App state: session, profile, trips, saved places. Thin layer over `repo`.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { repo, uid } from '@/data/repo';
import type { Discovery, Profile, SavedPlace, Stop, Trip } from '@/data/types';
import { supabase } from '@/services/supabase';
import { learn } from '@/services/personalization';
import { bestInsertIndex, getRoute, tripWaypoints } from '@/services/routing';

interface Store {
  ready: boolean;
  profile: Profile | null;
  trips: Trip[];
  saved: SavedPlace[];
  refresh(): Promise<void>;
  setProfile(p: Profile): Promise<void>;
  saveTrip(t: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  /** Adds a discovered place at the cheapest position, recalculates the real route. */
  addStop(trip: Trip, d: Discovery): Promise<Trip>;
  removeStop(trip: Trip, stopId: string): Promise<Trip>;
  moveStop(trip: Trip, stopId: string, dir: -1 | 1): Promise<Trip>;
  setStopStatus(trip: Trip, stopId: string, status: Stop['status']): Promise<Trip>;
  toggleSave(d: { placeId: string; name: string; lat: number; lng: number; category?: string; imageUrl?: string }): Promise<boolean>;
  dismiss(d: Discovery): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setP] = useState<Profile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [saved, setSaved] = useState<SavedPlace[]>([]);

  const refresh = useCallback(async () => {
    try {
      const id = await repo.currentUserId();
      if (!id) { setP(null); setTrips([]); setSaved([]); return; }
      const [p, t, s] = await Promise.all([repo.getProfile(), repo.listTrips(), repo.listSaved()]);
      setP(p); setTrips(t); setSaved(s);
    } catch (e) {
      console.warn('refresh failed', e);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => { refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const setProfile = useCallback(async (p: Profile) => { setP(p); await repo.saveProfile(p); }, []);

  const saveTrip = useCallback(async (t: Trip) => {
    setTrips((all) => [t, ...all.filter((x) => x.id !== t.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    await repo.saveTrip(t);
  }, []);

  const reroute = async (t: Trip): Promise<Trip> => {
    const stops = t.stops.map((s, i) => ({ ...s, sequence: i }));
    const pts = tripWaypoints(t.origin, stops, t.destination);
    const route = pts.length >= 2 ? await getRoute(pts, t.transport).catch(() => t.route) : t.route;
    return { ...t, stops, route };
  };

  const store = useMemo<Store>(() => ({
    ready, profile, trips, saved, refresh, setProfile, saveTrip,
    async deleteTrip(id) {
      setTrips((all) => all.filter((t) => t.id !== id));
      await repo.deleteTrip(id);
    },
    async addStop(trip, d) {
      if (trip.stops.some((s) => s.placeId === d.placeId)) return trip;
      const stop: Stop = {
        id: uid(), placeId: d.placeId, name: d.name, lat: d.lat, lng: d.lng, category: d.category,
        description: d.summary ?? d.why, imageUrl: d.imageUrl, sequence: 0, visitMin: d.visitMin, status: 'planned',
      };
      const stops = [...trip.stops];
      const active = stops.filter((s) => s.status !== 'skipped');
      const idx = bestInsertIndex(trip.origin, active, trip.destination, d);
      const anchor = active[idx];
      stops.splice(anchor ? stops.indexOf(anchor) : stops.length, 0, stop);
      const next = await reroute({ ...trip, stops, coverImage: trip.coverImage ?? d.imageUrl });
      await saveTrip(next);
      if (profile) await setProfile({ ...profile, affinity: learn(profile, d.category, 'add') });
      return next;
    },
    async removeStop(trip, stopId) {
      const next = await reroute({ ...trip, stops: trip.stops.filter((s) => s.id !== stopId) });
      await saveTrip(next);
      return next;
    },
    async moveStop(trip, stopId, dir) {
      const stops = [...trip.stops];
      const i = stops.findIndex((s) => s.id === stopId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stops.length) return trip;
      [stops[i], stops[j]] = [stops[j], stops[i]];
      const next = await reroute({ ...trip, stops });
      await saveTrip(next);
      return next;
    },
    async setStopStatus(trip, stopId, status) {
      const changesRoute = status === 'skipped' || trip.stops.find((s) => s.id === stopId)?.status === 'skipped';
      let next = { ...trip, stops: trip.stops.map((s) => (s.id === stopId ? { ...s, status } : s)) };
      if (changesRoute) next = await reroute(next);
      await saveTrip(next);
      return next;
    },
    async toggleSave(d) {
      const exists = saved.some((s) => s.placeId === d.placeId);
      if (exists) {
        setSaved((all) => all.filter((s) => s.placeId !== d.placeId));
        await repo.unsavePlace(d.placeId);
        return false;
      }
      const sp: SavedPlace = { ...d, savedAt: new Date().toISOString() };
      setSaved((all) => [sp, ...all]);
      await repo.savePlace(sp);
      if (profile) await setProfile({ ...profile, affinity: learn(profile, d.category, 'save') });
      return true;
    },
    async dismiss(d) {
      if (!profile) return;
      await setProfile({ ...profile, dismissed: [...profile.dismissed, d.placeId].slice(-500), affinity: learn(profile, d.category, 'dismiss') });
    },
    async signOut() { await repo.signOut(); await refresh(); },
  }), [ready, profile, trips, saved, refresh, setProfile, saveTrip]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
