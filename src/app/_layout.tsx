import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import { usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { useColorScheme, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import "../../global.css"
import { useTensorflowModel, loadTensorflowModelOnce } from '../providers/ModelProvider';
import BottomSheet, { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DemoModeProvider } from '../contexts/DemoModeContext';
import ClassicTabs from './tabs';
import { House, Map, Trophy } from 'lucide-react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';


Asset.loadAsync([
  ...NavigationAssets,
]);

SplashScreen.preventAutoHideAsync();
const prefix = createURL('/');

function ModelPreloader() {
  const { status } = useTensorflowModel();
  // Kick off single-load at app startup
  useEffect(() => {
    loadTensorflowModelOnce();
  }, []);

  useEffect(() => {
    if (status === 'success') {
      SplashScreen.hideAsync();
    }
  }, [status]);

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

function NativeTabHaptics() {
  const pathname = usePathname();
  const previousTabRef = useRef<string | null>(null);

  useEffect(() => {
    const currentTab = pathname.split('/').filter(Boolean)[0] ?? 'index';

    if (previousTabRef.current === null) {
      previousTabRef.current = currentTab;
      return;
    }

    if (previousTabRef.current !== currentTab) {
      Haptics.selectionAsync();
      previousTabRef.current = currentTab;
    }
  }, [pathname]);

  return null;
}


export default function TabLayout() {
  const ver = iosMajor();
  const useClassic = Platform.OS === 'android' || (ver !== null && ver <= 18);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme

  return (
    <DemoModeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ModelPreloader />

          {useClassic ? (
            <ClassicTabs />
          ) : (
            <>
              <NativeTabHaptics />
              <NativeTabs
                minimizeBehavior="onScrollDown"
                tintColor='#BF5700'
              >
                <NativeTabs.Trigger name="index">
                  <Label hidden>Home</Label>
                  <Icon sf="house.fill" drawable="custom_android_drawable" />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="calendar">
                  <Label hidden>Calendar</Label>
                  <Icon sf="calendar" drawable="custom_android_drawable" />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="social">
                  <Label hidden>Social</Label>
                  <Icon sf="person.3.fill" drawable="custom_android_drawable" />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="map">
                  <Label hidden>Map</Label>
                  <Icon sf="map.fill" drawable="custom_android_drawable" />
                </NativeTabs.Trigger>
                <NativeTabs.Trigger name="settings">
                  <Label hidden>Settings</Label>
                  <Icon sf="gear" drawable="custom_android_drawable" />
                </NativeTabs.Trigger>
              </NativeTabs>
            </>
          )}
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </DemoModeProvider>
  )
}
