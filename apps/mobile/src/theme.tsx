import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AppColors = {
  bg: string;
  card: string;
  cardElevated: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  track: string;
};

// Single green family (the #081c15 → #b7e4c7 scale). Red is reserved for genuine
// warnings (habit counts, weaknesses, low scores, destructive actions).
export const darkColors: AppColors = {
  bg: '#081c15',
  card: '#0e2a20',
  cardElevated: '#13352a',
  border: '#1b4332',
  text: '#e6f4ec',
  textDim: '#8fbfa9',
  textFaint: '#5f8d77',
  accent: '#52b788',
  accentSoft: '#16382a',
  onAccent: '#06170f',
  danger: '#ff6b6b',
  dangerSoft: '#3a1a1b',
  success: '#52b788',
  track: '#16382a',
};

export const lightColors: AppColors = {
  bg: '#f2faf5',
  card: '#ffffff',
  cardElevated: '#e6f5ec',
  border: '#c4e7d4',
  text: '#0b2118',
  textDim: '#477261',
  textFaint: '#6f9685',
  accent: '#2d6a4f',
  accentSoft: '#cdeede',
  onAccent: '#ffffff',
  danger: '#cf4040',
  dangerSoft: '#f7dede',
  success: '#2d6a4f',
  track: '#d4efe0',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Color for a 1–10 score: green when strong, neutral mid, red when weak. */
export function scoreColor(c: AppColors, score: number): string {
  if (score >= 7) return c.success;
  if (score >= 5) return c.textDim;
  return c.danger;
}

export type ThemeMode = 'light' | 'dark' | 'system';
const STORE_KEY = 'theme-mode';

interface ThemeCtx {
  colors: AppColors;
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  colors: darkColors,
  mode: 'system',
  resolved: 'dark',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    SecureStore.setItemAsync(STORE_KEY, m).catch(() => {});
  };

  const resolved: 'light' | 'dark' = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const value = useMemo(
    () => ({ colors: resolved === 'light' ? lightColors : darkColors, mode, resolved, setMode }),
    [resolved, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): AppColors {
  return useContext(ThemeContext).colors;
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}
