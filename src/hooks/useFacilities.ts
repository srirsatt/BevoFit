import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { facilityCache, facilityMarkers } from '../lib/facilityCache';

export function useFacilities() {
  const snapshot = useSyncExternalStore(facilityCache.subscribe, facilityCache.getSnapshot, facilityCache.getSnapshot);
  const markers = useMemo(() => facilityMarkers(snapshot.data), [snapshot.data]);

  useFocusEffect(useCallback(() => {
    void facilityCache.refresh();
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void facilityCache.refresh();
    });
    return () => subscription.remove();
  }, []);

  return {
    ...snapshot,
    markers,
    loading: snapshot.data === null && snapshot.error === null,
    refresh: facilityCache.refresh,
  };
}
