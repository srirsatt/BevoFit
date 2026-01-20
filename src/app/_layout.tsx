import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import "../../global.css"
import { useTensorflowModel, loadTensorflowModelOnce } from '../providers/ModelProvider';
import BottomSheet, { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ModelPreloader />
        <NativeTabs
          tintColor='#BF5700'
        >
          <NativeTabs.Trigger name="index">
            <Label>Home</Label>
            <Icon sf="house.fill" drawable="custom_android_drawable" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="intramurals">
            <Label>IM Sports</Label>
            <Icon sf="sportscourt.fill" drawable="custom_android_drawable" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="map">
            <Label>Map</Label>
            <Icon sf="map.fill" drawable="custom_android_drawable" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  )
}