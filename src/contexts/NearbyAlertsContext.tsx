import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { Alert, AppState, Linking } from 'react-native';
import {
  refreshFacilityGeofencing,
  startFacilityGeofencing, stopFacilityGeofencing,
  type NearbyAlertsStatus,
} from '../lib/facilityGeofencing';

type NearbyAlertsContextValue = {
  status: NearbyAlertsStatus;
  ready: boolean;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  refresh: () => Promise<void>;
};

const NearbyAlertsContext = createContext<NearbyAlertsContextValue | null>(null);

export function openNearbyAlertSettings() {
  void Linking.openSettings().catch(() => {
    Alert.alert('Open iPhone Settings', 'Open Settings on your iPhone, then choose BevoFit to update permissions.');
  });
}

export function NearbyAlertsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NearbyAlertsStatus>({
    preference: null, monitoring: false, issue: null, needsSettings: false,
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  const run = useCallback(async (operation: () => Promise<NearbyAlertsStatus>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const next = await operation();
      if (!mounted.current) return;
      setStatus(next);
      setReady(true);
    } catch (error) {
      console.error('Could not update nearby alert preference:', error);
      if (mounted.current) {
        // Show failures inline in Settings; never add a popup after an OS denial.
        setStatus((previous) => ({
          ...previous,
          issue: 'Could not save or load nearby alerts. Please try again.',
          needsSettings: false,
        }));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const refresh = useCallback(() => run(refreshFacilityGeofencing), [run]);
  const enable = useCallback(() => run(startFacilityGeofencing), [run]);
  const disable = useCallback(() => run(stopFacilityGeofencing), [run]);

  useEffect(() => {
    mounted.current = true;
    let previousState = AppState.currentState;
    // Read saved choices and refresh existing opt-ins without blocking the UI
    // or requesting permissions. Only the Settings toggle can call enable().
    if (previousState === 'active') void refresh();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') void refresh();
      previousState = nextState;
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [refresh]);

  return (
    <NearbyAlertsContext.Provider value={{ status, ready, busy, enable, disable, refresh }}>
      {children}
    </NearbyAlertsContext.Provider>
  );
}

export function useNearbyAlerts() {
  const context = useContext(NearbyAlertsContext);
  if (!context) throw new Error('useNearbyAlerts must be used inside NearbyAlertsProvider.');
  return context;
}
