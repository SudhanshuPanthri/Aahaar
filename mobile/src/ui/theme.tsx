/**
 * Shared design tokens + theming so all screens stay visually consistent.
 *  - `Palette` is the full token set; LIGHT / DARK are the two base palettes.
 *  - The user's accent choice (ACCENTS) overrides the `calories`/`accent`/
 *    `accentSoft` tokens at resolve time; macro/danger colours stay fixed.
 *  - `ThemeProvider` resolves 'system' via useColorScheme() and persists the
 *    preference + accent in the `app_setting` table (src/db/settings.ts).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../db/settings';

export const FONT = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export type Palette = {
  /* Surfaces */
  bg: string; // screen background
  card: string; // raised cards / chips
  sheet: string; // modal bottom sheets
  softBg: string; // subtly raised option rows
  /* Text */
  ink: string; // primary text
  sub: string; // secondary text
  dim: string; // tertiary text / section labels
  mute: string; // hints, "parsed via …" lines
  faint: string; // low-emphasis glyphs (✕, trash)
  disabled: string; // disabled icons / text
  placeholder: string; // input placeholder text
  /* Lines & fills */
  border: string;
  track: string; // progress-bar track
  inputBg: string;
  inputBorder: string;
  segmentBg: string; // segmented-control track
  segmentActive: string; // segmented-control active thumb
  overlay: string; // modal backdrop
  shadow: string;
  /* Misc */
  onAccent: string; // text/icons on accent-filled buttons
  tabIdle: string; // inactive tab icon/label
  danger: string;
  /* Accent (user-selectable; `calories` kept as the legacy name) */
  calories: string;
  accent: string; // alias of `calories`
  accentSoft: string; // faint accent-tinted background
  /* Semantic macro colours (fixed data colours, reused across Today card, calendar, trends) */
  protein: string;
  carbs: string;
  fat: string;
};

export const LIGHT: Palette = {
  bg: '#fff',
  card: '#f5f5f7',
  sheet: '#fff',
  softBg: '#fafafa',
  ink: '#1a1a1a',
  sub: '#666',
  dim: '#999',
  mute: '#888',
  faint: '#bbb',
  disabled: '#cfcfd4',
  placeholder: '#aaa',
  border: '#eee',
  track: '#e2e2e6',
  inputBg: '#fff',
  inputBorder: '#ddd',
  segmentBg: '#f0f0f2',
  segmentActive: '#fff',
  overlay: 'rgba(0,0,0,0.35)',
  shadow: '#000',
  onAccent: '#fff',
  tabIdle: '#9a9a9f',
  danger: '#c0392b',
  calories: '#e07a3f',
  accent: '#e07a3f',
  accentSoft: '#fdf1e9',
  protein: '#2e7d5b',
  carbs: '#3f6fe0',
  fat: '#e0a63f',
};

export const DARK: Palette = {
  bg: '#0f0f12',
  card: '#1c1c21',
  sheet: '#17171b',
  softBg: '#17171b',
  ink: '#f2f2f4',
  sub: '#a5a5ad',
  dim: '#77777f',
  mute: '#8e8e96',
  faint: '#55555c',
  disabled: '#3a3a41',
  placeholder: '#5c5c64',
  border: '#26262c',
  track: '#2a2a30',
  inputBg: '#1c1c21',
  inputBorder: '#33333a',
  segmentBg: '#1c1c21',
  segmentActive: '#33333a',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000',
  onAccent: '#fff',
  tabIdle: '#6f6f78',
  danger: '#e05a4a',
  calories: '#e88a52',
  accent: '#e88a52',
  accentSoft: '#2a1f18',
  protein: '#3fa47b',
  carbs: '#6a92ec',
  fat: '#e8b658',
};

/* ── User-selectable accents ───────────────────────────────────────────── */

export type AccentName = 'saffron' | 'emerald' | 'ocean' | 'berry' | 'violet';

export const ACCENTS: Record<AccentName, { light: string; dark: string; softLight: string; softDark: string }> = {
  saffron: { light: '#e07a3f', dark: '#e88a52', softLight: '#fdf1e9', softDark: '#2a1f18' }, // default
  emerald: { light: '#1f9d6b', dark: '#34c08b', softLight: '#e7f6ef', softDark: '#16281f' },
  ocean: { light: '#2f6fdb', dark: '#6b97f0', softLight: '#eaf1fd', softDark: '#182136' },
  berry: { light: '#c2447e', dark: '#e06ba3', softLight: '#fae9f2', softDark: '#2b1a24' },
  violet: { light: '#7048c9', dark: '#9a75e8', softLight: '#f1eafb', softDark: '#221a33' },
};

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

/* ── Theme context ─────────────────────────────────────────────────────── */

export type ThemeMode = 'light' | 'dark';
export type ThemePref = 'system' | ThemeMode;

type ThemeValue = {
  colors: Palette;
  mode: ThemeMode;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  accent: AccentName;
  setAccent: (a: AccentName) => void;
};

const THEME_PREF_KEY = 'theme_pref';
const ACCENT_KEY = 'accent_color';

const isPref = (v: string | null): v is ThemePref => v === 'system' || v === 'light' || v === 'dark';
const isAccent = (v: string | null): v is AccentName => v != null && v in ACCENTS;

export const ThemeContext = createContext<ThemeValue>({
  colors: LIGHT,
  mode: 'light',
  pref: 'system',
  setPref: () => {},
  accent: 'saffron',
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();

  // The provider mounts before initDb() finishes, so read defensively —
  // settings.ts creates its own table on demand, but never let a read crash us.
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try {
      const v = getSetting(THEME_PREF_KEY);
      return isPref(v) ? v : 'system';
    } catch {
      return 'system';
    }
  });
  const [accent, setAccentState] = useState<AccentName>(() => {
    try {
      const v = getSetting(ACCENT_KEY);
      return isAccent(v) ? v : 'saffron';
    } catch {
      return 'saffron';
    }
  });

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      setSetting(THEME_PREF_KEY, p);
    } catch {} // persist is best-effort; the in-memory pref still applies
  }, []);

  const setAccent = useCallback((a: AccentName) => {
    setAccentState(a);
    try {
      setSetting(ACCENT_KEY, a);
    } catch {}
  }, []);

  const mode: ThemeMode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  const colors = useMemo<Palette>(() => {
    const base = mode === 'dark' ? DARK : LIGHT;
    const a = ACCENTS[accent];
    const accentColor = mode === 'dark' ? a.dark : a.light;
    return {
      ...base,
      calories: accentColor,
      accent: accentColor,
      accentSoft: mode === 'dark' ? a.softDark : a.softLight,
    };
  }, [mode, accent]);

  const value = useMemo<ThemeValue>(
    () => ({ colors, mode, pref, setPref, accent, setAccent }),
    [colors, mode, pref, setPref, accent, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** @deprecated Static light palette kept for compatibility — use useTheme().colors instead. */
export const COLORS = LIGHT;
