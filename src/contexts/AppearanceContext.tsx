import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme, useColorScheme } from 'nativewind';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

export type AppearancePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'bevofit.appearance';

type AppearanceSettings = {
  preference: AppearancePreference;
  ready: boolean;
  saveError: string | null;
  select: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceSettings | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const { colorScheme: resolvedScheme } = useColorScheme();

  useEffect(() => {
    let active = true;
    async function restore() {
      let restored: AppearancePreference = 'system';
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') restored = saved;
      } catch {
        // A storage read failure still leaves a usable system-default appearance.
      }
      if (active) {
        colorScheme.set(restored);
        setPreference(restored);
        setReady(true);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const select = useCallback((next: AppearancePreference) => {
    if (!ready) return;
    colorScheme.set(next);
    setPreference(next);
    setSaveError(null);
    const currentRevision = ++revision.current;
    // Keep rapid taps in order so the last choice is the one restored next launch.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, next))
      .catch(() => {
        if (revision.current === currentRevision) {
          setSaveError('Couldn’t save your appearance. Tap your choice to try again.');
        }
      });
  }, [ready]);

  const isDark = resolvedScheme === 'dark';
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <AppearanceContext.Provider value={{ preference, ready, saveError, select }}>
      <ThemeProvider value={{ ...baseTheme, colors: { ...baseTheme.colors, primary: '#BF5700', background: isDark ? '#000000' : '#FFFFFF' } }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {children}
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}

export function useAppearanceSettings() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearanceSettings must be used inside AppearanceProvider.');
  return value;
}
