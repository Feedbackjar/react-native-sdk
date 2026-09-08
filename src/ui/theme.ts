import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export const DEFAULT_ACCENT = '#e5484d';

export interface Theme {
  accent: string;
  bg: string;
  text: string;
  textDim: string;
  divider: string;
  fieldBg: string;
}

const LIGHT = {
  bg: '#ffffff',
  text: '#1a1a1a',
  textDim: '#767676',
  divider: '#e6e6e6',
  fieldBg: '#f4f4f4',
};

const DARK = {
  bg: '#151515',
  text: '#f2f2f2',
  textDim: '#9a9a9a',
  divider: '#2c2c2c',
  fieldBg: '#242424',
};

const AccentContext = createContext<string>(DEFAULT_ACCENT);
export const AccentProvider = AccentContext.Provider;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const accent = useContext(AccentContext);
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return { accent, ...palette };
}

/** Two sizes, one bold weight — see UI-SPEC.md. */
export const FONT = {
  body: 15,
  small: 13,
} as const;

export const RADIUS = 8;

/** Compact relative time: "just now", "3h", "2d", "5w". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
}

/** OPEN → "Open", IN_PROGRESS → "In progress". */
export function humanStatus(status: string): string {
  const s = status.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
