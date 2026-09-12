import { requireOptionalNativeModule } from 'expo';

export type WalkingOrigin = {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy: number;
};

type WalkingDirectionsModule = {
    walkingTimeAsync(latitude: number, longitude: number, destinationLatitude: number, destinationLongitude: number): Promise<number>;
};

export function usableWalkingOrigin(origin: WalkingOrigin, now = Date.now()): boolean {
    return Number.isFinite(origin.latitude) && Math.abs(origin.latitude) <= 90
        && Number.isFinite(origin.longitude) && Math.abs(origin.longitude) <= 180
        && Number.isFinite(origin.accuracy) && origin.accuracy >= 0 && origin.accuracy <= 100
        && Number.isFinite(origin.timestamp) && now - origin.timestamp >= -10000
        && now - origin.timestamp <= 60000;
}

export async function walkingMinutes(origin: WalkingOrigin, destination: { lat: number; lng: number }): Promise<number | null> {
    if (!usableWalkingOrigin(origin)) return null;
    const nativeModule = requireOptionalNativeModule<WalkingDirectionsModule>('BevoWalkingDirections');
    if (!nativeModule?.walkingTimeAsync) return null;
    try {
        const seconds = await nativeModule.walkingTimeAsync(origin.latitude, origin.longitude, destination.lat, destination.lng);
        return Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, Math.ceil(seconds / 60)) : null;
    } catch {
        // No route, connectivity, or permission: keep the address without inventing an ETA.
        return null;
    }
}
