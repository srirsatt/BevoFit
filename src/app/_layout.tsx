import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Assets as NavigationAssets } from '@react-navigation/elements';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import "../../global.css"
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DemoModeProvider } from '../contexts/DemoModeContext';
import ClassicTabs from './tabs';
import '../lib/facilityGeofencing';
import { NearbyAlertsProvider } from '../contexts/NearbyAlertsContext';
import { GymNotificationProvider } from '../contexts/GymNotificationContext';
import { AppearanceProvider, useAppearanceSettings } from '../contexts/AppearanceContext';

void Asset.loadAsync([
  ...NavigationAssets,
]).catch(() => {});

void SplashScreen.preventAutoHideAsync().catch(() => {});

function LaunchReady() {
  const { ready: appearanceReady } = useAppearanceSettings();

  useEffect(() => {
    if (appearanceReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [appearanceReady]);

  return null;
}

// ios version checker

function iosMajor(): number | null {
  if (Platform.OS !== 'ios') return null;
  const ver = Platform.Version;

  if (typeof ver === 'number') {
    return ver;
  }

  const parsed = parseInt(String(ver), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function TabLayout() {
  const ver = iosMajor();
  const useClassic = Platform.OS !== 'ios' || ver === null || ver < 26;

  return (
    <AppearanceProvider>
      <DemoModeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <NearbyAlertsProvider>
              <GymNotificationProvider useClassic={useClassic}>
                <LaunchReady />
                {useClassic ? <ClassicTabs /> : (
                  <NativeTabs tintColor="#BF5700" labelStyle={{ fontSize: 10 }}>
                    <NativeTabs.Trigger name="index">
                      <Label>Home</Label>
                      <Icon src={require('../assets/icons/home-rounded.png')} />
                    </NativeTabs.Trigger>
                    <NativeTabs.Trigger name="calendar">
                      <Label>Calendar</Label>
                      <Icon sf="calendar" />
                    </NativeTabs.Trigger>
                    <NativeTabs.Trigger name="map">
                      <Label>Map</Label>
                      <Icon sf="map.fill" />
                    </NativeTabs.Trigger>
                    <NativeTabs.Trigger name="settings">
                      <Label>Settings</Label>
                      <Icon sf="gear" />
                    </NativeTabs.Trigger>
                  </NativeTabs>
                )}
              </GymNotificationProvider>
            </NearbyAlertsProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </DemoModeProvider>
    </AppearanceProvider>
  )
}
