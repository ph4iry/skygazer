export type DistanceUnit = 'mi' | 'km';

export const KM_PER_MILE = 1.609344;
// the range pills, in whichever unit is selected
export const RANGE_CHOICES = [100, 250, 500];
export const DEFAULT_RANGE = 250;
// the app is mostly for the US, so distances default to miles
export const DEFAULT_UNIT: DistanceUnit = 'mi';

const UNIT_STORAGE_KEY = 'skygazer:unit';

export function toKm(value: number, unit: DistanceUnit) {
  return unit === 'mi' ? value * KM_PER_MILE : value;
}

export function fromKm(km: number, unit: DistanceUnit) {
  return unit === 'mi' ? km / KM_PER_MILE : km;
}

export function formatDistance(km: number, unit: DistanceUnit) {
  return `${Math.round(fromKm(km, unit))} ${unit}`;
}

// the unit is remembered per browser; storage can be unavailable (private mode, blocked site data)
export function loadUnit(): DistanceUnit {
  try {
    const saved = window.localStorage.getItem(UNIT_STORAGE_KEY);
    if (saved === 'mi' || saved === 'km') return saved;
  } catch {}
  return DEFAULT_UNIT;
}

export function saveUnit(unit: DistanceUnit) {
  try {
    window.localStorage.setItem(UNIT_STORAGE_KEY, unit);
  } catch {}
}
