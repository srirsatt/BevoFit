import * as Location from 'expo-location';
import { canNotifyFacility } from './facilityNotifications';
import { handleFacilityEntry, loadProximityFacilities, type ProximityFacility } from './nearbyFacilityProximity';

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radians = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * radians / 2) ** 2
        + Math.cos(lat1 * radians) * Math.cos(lat2 * radians)
        * Math.sin((lng2 - lng1) * radians / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

// Connected boundaries share a cooldown, including A → B → C overlaps.
function overlapGroup(entered: ProximityFacility, facilities: ProximityFacility[]) {
    const group = [entered];
    const included = new Set([entered.id]);
    for (let index = 0; index < group.length; index++) {
        const current = group[index];
        for (const candidate of facilities) {
            if (included.has(candidate.id)) continue;
            if (distanceMeters(current.lat, current.lng, candidate.lat, candidate.lng)
                <= current.geofence_radius_meters + candidate.geofence_radius_meters) {
                included.add(candidate.id);
                group.push(candidate);
            }
        }
    }
    return group;
}

async function currentPosition(): Promise<Location.LocationObject | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // One fix only when boundaries overlap; no continuous location subscription.
        return await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 8000); }),
        ]);
    } catch {
        return null;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

// Called inside the geofencing service's queue so simultaneous entries cannot
// both pass the cooldown check before either notification has been recorded.
export async function handleOverlappingFacilityEntry(facilityId: string): Promise<boolean> {
    const facilities = (await loadProximityFacilities()).slice(0, 20);
    const entered = facilities.find((facility) => facility.id === facilityId);
    if (!entered) return false;

    const group = overlapGroup(entered, facilities);
    const allowed = await Promise.all(group.map((facility) => canNotifyFacility(facility.id)));
    if (allowed.some((value) => !value)) return false;

    if (group.length === 1) return handleFacilityEntry(entered.id);

    const position = await currentPosition();
    if (!position) return false; // Retry on a later entry rather than guess a gym.

    const candidates = group.map((facility) => ({
        facility,
        distance: distanceMeters(position.coords.latitude, position.coords.longitude, facility.lat, facility.lng),
    })).filter(({ facility, distance }) => distance <= facility.geofence_radius_meters)
        .sort((a, b) => (b.facility.priority ?? 0) - (a.facility.priority ?? 0)
            || a.distance - b.distance || a.facility.id.localeCompare(b.facility.id));

    for (const { facility } of candidates) {
        // Closed/disabled gyms are skipped; only the winner's existing history
        // is saved, and that history suppresses the entire group next time.
        if (await handleFacilityEntry(facility.id)) return true;
    }
    return false;
}
