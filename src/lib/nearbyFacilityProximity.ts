import { supabase } from './supabase';
import { isFacilityOpen, type FacilityHours } from './facilityHours';
import {
    notifyNearbyFacility,
    type NotificationFacility,
} from './facilityNotifications';


export const FACILITY_RADIUS_METERS = 150;

export type ProximityFacility = NotificationFacility & {
    lat: number;
    lng: number;
}; 

export async function loadProximityFacilities(): Promise<ProximityFacility[]> {

    // from supabase -> takes in latitude and longitude of each facility in specific
    const { data, error } = await supabase
        .from('facilities')
        .select(`
            id,
            name,
            lat,
            lng,
            facility_type,
            notification_title,
            notification_body
        `)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

    if (error) throw error;

    return (data ?? []).filter(
        (facility) => 
            Number.isFinite(facility.lat) &&
            Number.isFinite(facility.lng) &&
            Math.abs(facility.lat) <= 90 &&
            Math.abs(facility.lng) <= 180
    );
}


// for checking if a gym is open ONCE the phone realizes u are in notification radius -> dont wanna send noti when closed
export async function handleFacilityEntry(facilityId: string): Promise<boolean> {
    const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .select(`
            id,
            name,
            facility_type,
            notification_title,
            notification_body
        `)
        .eq('id', facilityId)
        .maybeSingle();

    if (facilityError) throw facilityError;
    if (!facility) return false;

    const { data: hours, error: hoursError } = await supabase
        .from('facility_hours')
        .select('mon, tue, wed, thu, fri, sat, sun, special_date, special_hours')
        .eq('facility_id', facilityId)
        .maybeSingle();

    if (hoursError) throw hoursError;

    const { isOpen } = isFacilityOpen(hours as FacilityHours | null);

    if (!isOpen) return false;

    return notifyNearbyFacility(facility);
}

