// Display units for distances. Everything is stored and computed in kilometres; only what people see changes.
// Miles by default (US); Profile → Units switches to kilometres. The store keeps this in sync with the profile.
import type { Units } from '@/data/types';

const KM_PER_MI = 1.609344;
let current: Units = 'mi';

export const setUnits = (u: Units | undefined) => { current = u === 'km' ? 'km' : 'mi'; };
export const getUnits = (): Units => current;

/** Short unit label: "mi" or "km". */
export const unitLabel = () => (current === 'km' ? 'km' : 'mi');
/** Long unit label: "miles" or "kilometers". */
export const unitWord = () => (current === 'km' ? 'kilometers' : 'miles');

/** Kilometres → the display unit (not rounded). */
export const kmToUnit = (km: number) => (current === 'km' ? km : km / KM_PER_MI);
/** Display-unit value → kilometres, rounded to 0.1 (the database keeps one decimal). */
export const unitToKm = (v: number) => Math.round((current === 'km' ? v : v * KM_PER_MI) * 10) / 10;

/** "450 ft", "2.4 mi", "38 mi" — or "450 m", "3.9 km", "61 km". */
export function fmtDistance(km: number): string {
  if (current === 'km') return km < 1 ? `${Math.round(km * 1000)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  const mi = km / KM_PER_MI;
  if (mi < 0.1) return `${Math.round((mi * 5280) / 10) * 10} ft`;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi).toLocaleString()} mi`;
}

/** Whole-number distance in the display unit, for stats ("38"). */
export const roundDistance = (km: number) => Math.round(kmToUnit(km));

/** Detour choices in the display unit, each with the kilometres that get stored. */
export function detourChoices(): { label: string; value: number; km: number }[] {
  const values = current === 'km' ? [5, 10, 20, 40, 80] : [3, 5, 10, 25, 50];
  return values.map((v) => ({ label: `${v} ${unitLabel()}`, value: v, km: unitToKm(v) }));
}

/** The stored detour (km) shown in the display unit, e.g. "12 mi". */
export const fmtDetour = (km: number) => `${Math.round(kmToUnit(km))} ${unitLabel()}`;
