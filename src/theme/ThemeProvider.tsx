/**
 * Provides the active theme to the application.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkTheme } from './dark';
import { lightTheme } from './light';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';
import { Theme } from './types';

export type ThemePreference = 'system' | 'light' | 'dark';
type ThemeMode = Exclude<ThemePreference, 'system'>;
const THEME_STORAGE_KEY = '@ashwamedhmart_theme';

type ThemeContextType = {
  theme: Theme;
  mode: ThemeMode;
  preference: ThemePreference;
  setMode: (mode: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined,
);

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedPreference) => {
        if (
          isMounted &&
          (storedPreference === 'system' ||
            storedPreference === 'light' ||
            storedPreference === 'dark')
        ) {
          setPreference(storedPreference);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load theme preference:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const mode: ThemeMode =
    preference === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const setMode = (nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextPreference).catch(
      (error: unknown) => {
        console.error('Failed to save theme preference:', error);
      },
    );
  };

  const theme = useMemo<Theme>(() => {
    const baseTheme =
      mode === 'dark' ? darkTheme : lightTheme;

    return {
      ...baseTheme,
      spacing,
      radius,
      shadows,
      typography,
    };
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        preference,
        setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used inside ThemeProvider.',
    );
  }

  return context;
}