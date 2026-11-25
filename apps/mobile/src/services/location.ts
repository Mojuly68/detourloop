// Location: one-shot, foreground only, after an explicit ask. No background tracking.
// If permission is denied the UI offers manual entry (search a place) instead.
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export type LocState = { status: 'idle' | 'asking' | 'ok' | 'denied' | 'error'; lat?: number; lng?: number; error?: string };

export async function permissionStatus() {
  try { return (await Location.getForegroundPermissionsAsync()).status; } catch { return 'undetermined'; }
}

export async function locateOnce(): Promise<{ lat: number; lng: number }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw Object.assign(new Error('Location permission was not granted'), { code: 'denied' });
  const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function useLocation() {
  const [loc, setLoc] = useState<LocState>({ status: 'idle' });
  const request = useCallback(async () => {
    setLoc({ status: 'asking' });
    try {
      const p = await locateOnce();
      setLoc({ status: 'ok', ...p });
      return p;
    } catch (e: any) {
      setLoc({ status: e?.code === 'denied' ? 'denied' : 'error', error: e?.message });
      return null;
    }
  }, []);
  const setManual = useCallback((p: { lat: number; lng: number }) => setLoc({ status: 'ok', ...p }), []);
  return { loc, request, setManual };
}
