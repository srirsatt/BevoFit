import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';

type PendingGym = { notificationId: string; facilityId: string };
type GymNotificationState = {
    pendingGym: PendingGym | null;
    consumeGymNotification: (notificationId: string) => void;
};

const GymNotificationContext = createContext<GymNotificationState | null>(null);

export function GymNotificationProvider({ children, useClassic }: {
    children: React.ReactNode;
    useClassic: boolean;
}) {
    // Expo supplies both the cold-start response and taps while already running.
    const response = Notifications.useLastNotificationResponse();
    const router = useRouter();
    const rootState = useRootNavigationState();
    const handledIds = useRef(new Set<string>());
    const [pendingGym, setPendingGym] = useState<PendingGym | null>(null);

    useEffect(() => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { identifier, content } = response.notification.request;
        const facilityId = content.data?.facilityId;
        if (typeof facilityId !== 'string' || !facilityId.trim() || handledIds.current.has(identifier)) return;
        setPendingGym((current) => current?.notificationId === identifier
            ? current : { notificationId: identifier, facilityId });
    }, [response]);

    useEffect(() => {
        if (pendingGym && !useClassic && rootState?.key) router.navigate('/');
    }, [pendingGym, useClassic, rootState?.key, router]);

    const consumeGymNotification = useCallback((notificationId: string) => {
        handledIds.current.add(notificationId);
        setPendingGym((current) => current?.notificationId === notificationId ? null : current);
        // Never clear a newer tap while finishing an earlier one.
        if (Notifications.getLastNotificationResponse()?.notification.request.identifier === notificationId) {
            Notifications.clearLastNotificationResponse();
        }
    }, []);

    return (
        <GymNotificationContext.Provider value={{ pendingGym, consumeGymNotification }}>
            {children}
        </GymNotificationContext.Provider>
    );
}

export function useGymNotification() {
    const context = useContext(GymNotificationContext);
    if (!context) throw new Error('useGymNotification must be inside GymNotificationProvider');
    return context;
}
