import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { FacilityHours } from './facilityHours';
import type { FacilityMarker } from './facilities';

export type CachedFacility = {
  id: string;
  name: string;
  slug?: string | null;
  lat?: number | null;
  lng?: number | null;
  addr?: string | null;
  facility_url?: string | null;
  hero_image_path?: string | null;
  general_info?: string | null;
  facility_activities?: { activity: string }[] | null;
  facility_features?: { feature: string }[] | null;
  facility_hours?: FacilityHours | null;
};

type Snapshot = {
  data: CachedFacility[] | null;
  savedAt: number | null;
  refreshing: boolean;
  error: string | null;
};

const CACHE_KEY = `bevofit.facilities.v1:${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'default'}`;
const FRESH_FOR = 5 * 60 * 1000;
const MAX_SAVED_AGE = 24 * 60 * 60 * 1000;
const SELECT = 'id, name, slug, lat, lng, addr, facility_url, hero_image_path, general_info, facility_activities ( activity ), facility_features ( feature ), facility_hours ( * )';
let snapshot: Snapshot = { data: null, savedAt: null, refreshing: false, error: null };
let hydration: Promise<void> | null = null;
let inFlight: Promise<void> | null = null;
let lastSuccess: number | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function validFacilities(value: unknown): value is CachedFacility[] {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item);
  return Array.isArray(value) && value.every((item) => {
    if (!record(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return false;
    if (!['slug', 'addr', 'facility_url', 'hero_image_path', 'general_info'].every((key) => item[key] == null || typeof item[key] === 'string')) return false;
    if (!['lat', 'lng'].every((key) => item[key] == null || (typeof item[key] === 'number' && Number.isFinite(item[key])))) return false;
    for (const [key, field] of [['facility_activities', 'activity'], ['facility_features', 'feature']]) {
      const relation = item[key];
      if (relation != null && (!Array.isArray(relation) || !relation.every((row) => record(row) && typeof row[field] === 'string'))) return false;
    }
    const hours = item.facility_hours;
    return hours == null || (record(hours)
      && ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'special_date', 'special_hours']
        .every((key) => hours[key] == null || typeof hours[key] === 'string'));
  });
}

function hydrate(): Promise<void> {
  if (!hydration) hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const age = Date.now() - saved.savedAt;
      if (saved.version === 1 && Number.isFinite(saved.savedAt) && age >= 0 && age <= MAX_SAVED_AGE && validFacilities(saved.data)) {
        publish({ data: saved.data, savedAt: saved.savedAt });
      }
    } catch {
      // Missing, corrupt, or unavailable storage must not prevent a network load.
    }
  })();
  return hydration;
}

async function refresh(force = false): Promise<void> {
  await hydrate();
  if (inFlight) return inFlight;
  const age = lastSuccess === null ? Infinity : Date.now() - lastSuccess;
  if (!force && age >= 0 && age < FRESH_FOR) return;

  inFlight = (async () => {
    publish({ refreshing: true, error: null });
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        supabase.from('facilities').select(SELECT).abortSignal(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error('Gym info request timed out.'));
            controller.abort();
          }, 15000);
        }),
      ]);
      if (result.error) throw result.error;
      if (!validFacilities(result.data)) throw new Error('Gym info has an unexpected format.');
      const savedAt = Date.now();
      lastSuccess = savedAt;
      publish({ data: result.data, savedAt });
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, savedAt, data: result.data }));
      } catch {
        // Keep fresh data in memory even if the phone cannot save it to disk.
      }
    } catch (error) {
      publish({ error: error instanceof Error ? error.message : 'Couldn’t refresh gym info.' });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      publish({ refreshing: false });
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export const facilityCache = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  refresh,
};

export function facilityMarkers(data: CachedFacility[] | null): FacilityMarker[] {
  return (data ?? []).flatMap((item) => typeof item.lat === 'number' && Math.abs(item.lat) <= 90
    && typeof item.lng === 'number' && Math.abs(item.lng) <= 180
    ? [{ id: item.id, name: item.name, lat: item.lat, lng: item.lng, addr: item.addr ?? '', general_info: item.general_info ?? '' }]
    : []);
}
