import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { hasPreciseLocationPermission } from '../../modules/location-accuracy';
import {
  hasNotificationPermission,
  requestNotificationPermissions,
} from './facilityNotifications';
import { loadProximityFacilities } from './nearbyFacilityProximity';
import { handleOverlappingFacilityEntry } from './facilityOverlap';

const TASK_NAME = 'nearby-facility-geofencing';
const PREFERENCE_KEY = 'nearby_facility_alerts_preference';

export type NearbyAlertsPreference = 'enabled' | 'disabled' | null;
export type NearbyAlertsStatus = {
  preference: NearbyAlertsPreference;
  monitoring: boolean;
  issue: string | null;
  needsSettings: boolean;
};

type GeofenceEvent = {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
};

// Serialize registration, disabling, and events so an older refresh cannot
// finish after a later disable and turn monitoring back on.
let pending: Promise<unknown> = Promise.resolve();
function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

async function readPreference(): Promise<NearbyAlertsPreference> {
  const saved = await AsyncStorage.getItem(PREFERENCE_KEY);
  return saved === 'enabled' || saved === 'disabled' ? saved : null;
}

async function stopMonitoring(): Promise<void> {
  if (await Location.hasStartedGeofencingAsync(TASK_NAME)) {
    await Location.stopGeofencingAsync(TASK_NAME);
  }
}

async function regionsAreUnchanged(regions: Location.LocationRegion[]): Promise<boolean> {
  const options = await TaskManager.getTaskOptionsAsync(TASK_NAME) as {
    regions?: Location.LocationRegion[];
  } | null;
  const current = options?.regions;
  if (!Array.isArray(current) || current.length !== regions.length) return false;
  return regions.every((region) => current.some((existing) =>
    existing.identifier === region.identifier &&
    existing.latitude === region.latitude &&
    existing.longitude === region.longitude &&
    existing.radius === region.radius &&
    existing.notifyOnEnter === region.notifyOnEnter &&
    existing.notifyOnExit === region.notifyOnExit
  ));
}

async function getPermissionIssue(request: boolean): Promise<string | null> {
  if (!(await Location.hasServicesEnabledAsync())) {
    return 'Turn on Location Services in iPhone Settings to receive nearby alerts.';
  }

  const notificationsAllowed = request
    ? await requestNotificationPermissions()
    : await hasNotificationPermission();
  if (!notificationsAllowed) {
    return 'Allow notifications for BevoFit in iPhone Settings.';
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (request && !background.granted && background.canAskAgain) {
    // On iOS, requesting Always directly lets the OS stage its own initial
    // location prompt and later Always confirmation. Do not separately ask
    // for When In Use first and immediately follow it with an upgrade prompt.
    background = await Location.requestBackgroundPermissionsAsync();
  }
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    return 'Allow location access for BevoFit in iPhone Settings.';
  }
  if (!background.granted) {
    return 'Set BevoFit’s location access to Always in iPhone Settings to receive alerts in the background.';
  }
  if (!(await hasPreciseLocationPermission())) {
    return 'Turn on Precise Location for BevoFit in iPhone Settings so nearby gym boundaries can be detected.';
  }
  return null;
}

async function synchronize(requestPermissions: boolean): Promise<NearbyAlertsStatus> {
  if (Platform.OS !== 'ios') {
    return { preference: 'disabled', monitoring: false, issue: null, needsSettings: false };
  }

  let preference = await readPreference();
  let monitoring = await Location.hasStartedGeofencingAsync(TASK_NAME);

  // Preserve users who enabled alerts before the preference was introduced.
  if (preference === null && monitoring) {
    preference = 'enabled';
    await AsyncStorage.setItem(PREFERENCE_KEY, preference);
  }

  if (preference !== 'enabled') {
    await stopMonitoring();
    return { preference, monitoring: false, issue: null, needsSettings: false };
  }

  try {
    if (!(await TaskManager.isAvailableAsync())) {
      throw new Error('Background tasks are unavailable in this build.');
    }

    const issue = await getPermissionIssue(requestPermissions);
    if (issue) {
      await stopMonitoring();
      return { preference, monitoring: false, issue, needsSettings: true };
    }

    const facilities = await loadProximityFacilities();
    const regions: Location.LocationRegion[] = facilities.slice(0, 20).map((facility) => ({
      identifier: facility.id,
      latitude: facility.lat,
      longitude: facility.lng,
      radius: facility.geofence_radius_meters,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    if (regions.length === 0) {
      await stopMonitoring();
      monitoring = false;
    } else if (!monitoring || !(await regionsAreUnchanged(regions))) {
      await Location.startGeofencingAsync(TASK_NAME, regions);
      monitoring = true;
    }

    return {
      preference,
      monitoring,
      issue: regions.length === 0 ? 'No gyms currently have nearby alerts available.' : null,
      needsSettings: false,
    };
  } catch (error) {
    // Keep existing regions on a transient network failure. Retry on next foreground.
    console.error('Could not refresh nearby gym alerts:', error);
    return {
      preference,
      monitoring,
      issue: 'Could not refresh nearby alerts. Please try again.',
      needsSettings: false,
    };
  }
}

// Explicitly enabling from Settings can request permissions again if iOS allows it.
export function startFacilityGeofencing(): Promise<NearbyAlertsStatus> {
  return runExclusive(async () => {
    if (Platform.OS === 'ios') {
      await AsyncStorage.setItem(PREFERENCE_KEY, 'enabled');
    }
    return synchronize(true);
  });
}

export function stopFacilityGeofencing(): Promise<NearbyAlertsStatus> {
  return runExclusive(async () => {
    if (Platform.OS === 'ios') {
      // Save first so queued events are ignored even if native stop fails.
      await AsyncStorage.setItem(PREFERENCE_KEY, 'disabled');
      await stopMonitoring();
    }
    return { preference: 'disabled', monitoring: false, issue: null, needsSettings: false };
  });
}

// Startup and foreground refreshes never ask for permission.
export function refreshFacilityGeofencing(): Promise<NearbyAlertsStatus> {
  return runExclusive(() => synchronize(false));
}

if (Platform.OS === 'ios' && !TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask<GeofenceEvent>(TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Geofencing error:', error);
      return;
    }
    if (!data || data.eventType !== Location.GeofencingEventType.Enter) return;
    const facilityId = data.region.identifier;
    if (!facilityId) return;

    try {
      await runExclusive(async () => {
        if ((await readPreference()) !== 'enabled') return;
        if (await getPermissionIssue(false)) return;
        const sent = await handleOverlappingFacilityEntry(facilityId);
        if (__DEV__) console.log('Gym entry:', facilityId, 'Notification sent:', sent);
      });
    } catch (error) {
      console.error('Could not handle gym entry:', error);
    }
  });
}
