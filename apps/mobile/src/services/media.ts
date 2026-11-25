// MediaOrganizationService: picks photos/videos (with explicit permission), reads their date and
// GPS from EXIF when the user allows it, and matches each item to the nearest trip stop.
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { Media, Stop, Trip } from '@/data/types';
import { repo } from '@/data/repo';
import { haversineKm } from './geo';

function exifDate(exif: Record<string, any> | null | undefined): string | undefined {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.['{Exif}']?.DateTimeOriginal;
  if (typeof raw !== 'string') return undefined;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString() : undefined;
}

function exifGps(exif: Record<string, any> | null | undefined): { lat: number; lng: number } | undefined {
  const g = exif?.['{GPS}'] ?? exif;
  let lat = g?.GPSLatitude ?? g?.Latitude, lng = g?.GPSLongitude ?? g?.Longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if ((g.GPSLatitudeRef ?? g.LatitudeRef) === 'S') lat = -Math.abs(lat);
  if ((g.GPSLongitudeRef ?? g.LongitudeRef) === 'W') lng = -Math.abs(lng);
  return { lat, lng };
}

/** Nearest non-skipped stop within 3 km, if any. */
export function nearestStop(stops: Stop[], p?: { lat: number; lng: number }) {
  if (!p) return undefined;
  let best: Stop | undefined, d = 3;
  for (const s of stops) {
    if (s.status === 'skipped') continue;
    const k = haversineKm(s, p);
    if (k < d) { d = k; best = s; }
  }
  return best;
}

export type PickResult = { added: Media[]; skipped: number; error?: string };

export async function pickAndAdd(trip: Trip, from: 'library' | 'camera', here?: { lat: number; lng: number }): Promise<PickResult> {
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { added: [], skipped: 0, error: from === 'camera' ? 'Camera access was not allowed.' : 'Photo library access was not allowed. You can change this in Settings.' };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], exif: true, quality: 0.85, allowsMultipleSelection: from === 'library', selectionLimit: 30, videoMaxDuration: 60 };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return { added: [], skipped: 0 };
  const added: Media[] = [];
  let skipped = 0;
  for (const a of res.assets) {
    const isVideo = a.type === 'video' || a.type === 'pairedVideo';
    if (isVideo && Platform.OS === 'web' && repo.kind === 'local') { skipped++; continue; } // can't persist video in browser demo storage
    const gps = exifGps(a.exif) ?? (from === 'camera' ? here : undefined);
    const fileDate = (a as any).file?.lastModified ? new Date((a as any).file.lastModified).toISOString() : undefined;
    const capturedAt = exifDate(a.exif) ?? (from === 'camera' ? new Date().toISOString() : fileDate);
    try {
      const m = await repo.addMedia(trip.id, {
        type: isVideo ? 'video' : 'photo', uri: a.uri, capturedAt, lat: gps?.lat, lng: gps?.lng, favorite: false,
        stopId: nearestStop(trip.stops, gps)?.id, durationMs: a.duration ?? undefined, mimeType: a.mimeType ?? undefined, file: (a as any).file,
      });
      added.push(m);
    } catch (e: any) {
      return { added, skipped, error: e?.message ?? 'Could not save that file.' };
    }
  }
  return { added, skipped };
}
