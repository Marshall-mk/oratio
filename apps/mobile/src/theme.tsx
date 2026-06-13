import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Premium Forest Green — semantic tokens. Components consume these, never hex.
export type AppColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  onPrimary: string; // text/icon on a primary-filled surface
  success: string;
  warning: string; // gold — "needs improvement / caution" accent
  warningSoft: string; // tinted warning background (badges, pills)
  danger: string;
  dangerSoft: string; // tinted danger background (badges, pills)
  progressTrack: string;
  progressFill: string;
  tabActive: string;
  tabInactive: string;
};

export const lightColors: AppColors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceElevated: '#F6F8F6',
  surfaceMuted: '#EEF3EF',
  border: '#E3E7E4',
  borderStrong: '#CBD6CE',
  textPrimary: '#0B0F0D',
  textSecondary: '#4F5F56',
  textMuted: '#7A8880',
  primary: '#2F6F4E',
  primaryHover: '#3E7C59',
  primaryMuted: '#DDEBE3',
  onPrimary: '#FFFFFF',
  success: '#3E7C59',
  warning: '#9F7A2E',
  warningSoft: '#F2E8D2',
  danger: '#C94C4C',
  dangerSoft: '#F6E1E1',
  progressTrack: '#DDEBE3',
  progressFill: '#2F6F4E',
  tabActive: '#2F6F4E',
  tabInactive: '#6F7D75',
};

export const darkColors: AppColors = {
  background: '#0B0F0D',
  surface: '#141A17',
  surfaceElevated: '#1A211D',
  surfaceMuted: '#202B25',
  border: '#232B27',
  borderStrong: '#314039',
  textPrimary: '#FAFAFA',
  textSecondary: '#B8C2BC',
  textMuted: '#7F8C86',
  primary: '#5AAE7F',
  primaryHover: '#76C99A',
  primaryMuted: '#1E3A2B',
  onPrimary: '#0B0F0D',
  success: '#5AAE7F',
  warning: '#D4B15A',
  warningSoft: '#2E2716',
  danger: '#FF7474',
  dangerSoft: '#3A1F1F',
  progressTrack: '#22352B',
  progressFill: '#5AAE7F',
  tabActive: '#5AAE7F',
  tabInactive: '#7F8C86',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Color for a 1–10 score: green when strong, neutral mid, red when weak. */
export function scoreColor(c: AppColors, score: number): string {
  if (score >= 7) return c.success;
  if (score >= 5) return c.textSecondary;
  return c.warning;
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
