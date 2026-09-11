import { supabase } from './supabase';
import { isFacilityOpen, type FacilityHours } from './facilityHours';
import {
    notifyNearbyFacility,
    type NotificationFacility,
} from './facilityNotifications';



export type ProximityFacility = NotificationFacility & {
    lat: number;
    lng: number;
    geofence_radius_meters: number;
    notifications_enabled: boolean;
    priority: number | null;
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
            notification_body,
            geofence_radius_meters,
            notifications_enabled,
            priority
        `)
        .eq('notifications_enabled', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gt('geofence_radius_meters', 0)
        .order('priority', { ascending: false, nullsFirst: false });


    if (error) throw error;

    return (data ?? []).filter(
        (facility) => 
            Number.isFinite(facility.lat) &&
            Number.isFinite(facility.lng) &&
            Math.abs(facility.lat) <= 90 &&
            Math.abs(facility.lng) <= 180 &&
            Number.isFinite(facility.geofence_radius_meters) && facility.geofence_radius_meters > 0
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
        .eq('notifications_enabled', true)
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

