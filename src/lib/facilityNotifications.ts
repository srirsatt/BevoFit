import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const FACILITY_NOTIFICATION_HISTORY_KEY = 'nearby_facility_notification_history';
const FACILITY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hr

export type NotificationFacility = {
    id: string;
    name: string;
    facility_type?: string | null;
    notification_title?: string | null;
    notification_body?: string | null;
};

type FacilityNotificationContent = {
    title: string;
    body: string;
};

type NotificationHistory = Record<string, number>;

// get noti perms
export async function requestNotificationPermissions(): Promise<boolean> {
    const currentPermissions = await Notifications.getPermissionsAsync();

    if (
        currentPermissions.granted || currentPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
        return true;
    }

    const requestedPermissions = await Notifications.requestPermissionsAsync();

    return (
        requestedPermissions.granted || requestedPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
}

// backup notifications

function getFallbackNotificationBody(facility: NotificationFacility): string {
    switch (facility.facility_type) {
        /* 
        weight_room - bellmont
        grass_field - whitaker, clark turf
        swimming - natatorium, null
        gym - rec greg

        */

        case 'weight_room':
            return `You're near ${facility.name}! Scan in and get a lift in!`;
        case 'grass_field':
            return `You're near ${facility.name}! Scan in and hop into pickup games!`;
        case 'gym':
            return `You're near ${facility.name}! Scan in and exercise!`;
        default:
            return `${facility.name} is nearby.`
    }
}

export function buildFacilityNotification(facility: NotificationFacility): FacilityNotificationContent {
    const title = facility.notification_title?.trim() || facility.name;
    const body = facility.notification_body?.trim() || getFallbackNotificationBody(facility);

    return { title, body };
}

async function getNotificationHistory(): Promise<NotificationHistory> {
    // to make sure notifications have a cooldown

    const raw = await AsyncStorage.getItem(FACILITY_NOTIFICATION_HISTORY_KEY);

    if (!raw) return {};

    try {
        return JSON.parse(raw) as NotificationHistory;
    } catch {
        return {};
    }
}

async function saveNotificationHistory(history: NotificationHistory): Promise<void> {
    await AsyncStorage.setItem(
        FACILITY_NOTIFICATION_HISTORY_KEY,
        JSON.stringify(history)
    );
}

export async function canNotifyFacility(facilityId: string): Promise<boolean> {
    const history = await getNotificationHistory();
    const lastNotifiedAt = history[facilityId];

    if (!lastNotifiedAt) return true;

    return Date.now() - lastNotifiedAt >= FACILITY_COOLDOWN_MS;
}

export async function markFacilityNotified(facilityId: string): Promise<void> {
    const history = await getNotificationHistory();

    history[facilityId] = Date.now();

    await saveNotificationHistory(history);
}


export async function notifyNearbyFacility(facility: NotificationFacility): Promise<boolean> {
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
        return false;
    }

    const canNotify = await canNotifyFacility(facility.id);

    if (!canNotify) {
        return false;
    }

    const notification = buildFacilityNotification(facility);
    await Notifications.scheduleNotificationAsync({
        content: {
            title: notification.title,
            body: notification.body,
            data: {
                facilityId: facility.id,
                facilityName: facility.name,
                facilityType: facility.facility_type,
            },
        },
        trigger: null,
    });

    await markFacilityNotified(facility.id);

    return true;
}








