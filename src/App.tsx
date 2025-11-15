import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Navigation } from './navigation';
import "../global.css"

import { useTensorflowModel, loadTensorflowModelOnce } from './providers/ModelProvider';


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


export function App() {
  const colorScheme = useColorScheme();

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme

  return (
    <>
      <ModelPreloader />
      <Navigation
        theme={theme}
        linking={{
          enabled: 'auto',
          prefixes: [prefix],
        }}
        onReady={() => {
          SplashScreen.hideAsync();
        }}
      />
    </>
  );
}
