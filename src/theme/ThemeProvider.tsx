/**
 * Provides the active theme to the application.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme } from './dark';
import { lightTheme } from './light';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';
import { Theme } from './types';

type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
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

  const [mode, setMode] = useState<ThemeMode>(
    systemColorScheme === 'dark' ? 'dark' : 'light',
  );

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