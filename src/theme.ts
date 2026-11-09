import { AppIconId, CustomTheme, ThemeId } from './types';

export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  income: string;
  expense: string;
  ok: string;
  warn: string;
  danger: string;
  dangerBg: string;
}

const light: Palette = {
  dark: false,
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F3',
  border: '#E1E4E8',
  text: '#15181D',
  textMuted: '#6A717C',
  accent: '#2F6FEB',
  accentText: '#FFFFFF',
  income: '#1E9E5A',
  expense: '#15181D',
  ok: '#22A35A',
  warn: '#E0A100',
  danger: '#D93B3B',
  dangerBg: '#FDECEC',
};

const dark: Palette = {
  dark: true,
  bg: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#22262E',
  border: '#2B3038',
  text: '#ECEEF1',
  textMuted: '#9AA1AC',
  accent: '#5B8CFF',
  accentText: '#FFFFFF',
  income: '#4CD38A',
  expense: '#ECEEF1',
  ok: '#4CD38A',
  warn: '#F2C14E',
  danger: '#FF6B6B',
  dangerBg: '#3A1C1E',
};

export const THEMES: Record<Exclude<ThemeId, 'system' | 'custom'>,{ label: string; supporter: boolean; palette: Palette }> = {
  light: { label: 'Light', supporter: false, palette: light },
  dark: { label: 'Dark', supporter: false, palette: dark },
  midnight: {
    label: 'Midnight',
    supporter: true,
    palette: { ...dark, bg: '#0B0B1A', surface: '#14142B', surfaceAlt: '#1E1E3D', border: '#2A2A52', accent: '#A78BFA', textMuted: '#A3A3C8' },
  },
  forest: {
    label: 'Forest',
    supporter: true,
    palette: { ...dark, bg: '#0E1712', surface: '#15221B', surfaceAlt: '#1D2E24', border: '#28402F', accent: '#6FCF97', accentText: '#0E1712', textMuted: '#9DB8A6' },
  },
  sunset: {
    label: 'Sunset',
    supporter: true,
    palette: { ...light, bg: '#FFF5EE', surface: '#FFFFFF', surfaceAlt: '#FFE9DA', border: '#F6D5C0', accent: '#F06A3B', text: '#2B1A12', expense: '#2B1A12', textMuted: '#8A6A5A' },
  },
  paper: {
    label: 'Paper',
    supporter: true,
    palette: { ...light, bg: '#F4EFE6', surface: '#FBF8F2', surfaceAlt: '#ECE5D8', border: '#DDD3C2', accent: '#7A5C3E', text: '#2E2A24', expense: '#2E2A24', textMuted: '#7D7468' },
  },
};

export const APP_ICONS: Record<AppIconId, { glyph: string; label: string; supporter: boolean }> = {
  coin: { glyph: '💰', label: 'FinTrack', supporter: false }, // rendered as assets/logo.png by AppBadge
  leaf: { glyph: '🌿', label: 'Leaf', supporter: true },
  rocket: { glyph: '🚀', label: 'Rocket', supporter: true },
  gem: { glyph: '💎', label: 'Gem', supporter: true },
  cat: { glyph: '🐈', label: 'Cat', supporter: true },
};

/* ------------------------------------------------- custom (supporter) theme */

export const HEX_RE = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
/** Blend a toward b by t (0–1). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
export function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Build a full palette from the four colours a supporter picks. Everything else is derived. */
export function customPalette(c: Partial<CustomTheme> | undefined): Palette {
  const safe = (v: unknown, fallback: string) => (typeof v === 'string' && HEX_RE.test(v) ? v : fallback);
  const bg = safe(c?.bg, '#101418');
  const surface = safe(c?.surface, '#1A2026');
  const text = safe(c?.text, '#ECEFF3');
  const accent = safe(c?.accent, '#14A394');
  const isDark = luminance(bg) < 0.2;
  const base = isDark ? dark : light;
  return {
    ...base,
    dark: isDark,
    bg,
    surface,
    surfaceAlt: mix(surface, text, 0.07),
    border: mix(surface, text, 0.14),
    text,
    textMuted: mix(text, surface, 0.4),
    expense: text,
    accent,
    accentText: contrast(accent, '#FFFFFF') >= contrast(accent, '#111111') ? '#FFFFFF' : '#111111',
  };
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = { bg: '#101418', surface: '#1A2026', text: '#ECEFF3', accent: '#14A394' };

export function resolvePalette(theme: ThemeId, systemDark: boolean, supporter: boolean, custom?: CustomTheme): Palette {
  if (theme === 'system') return systemDark ? dark : light;
  if (theme === 'custom') return supporter ? customPalette(custom ?? DEFAULT_CUSTOM_THEME) : systemDark ? dark : light;
  const t = THEMES[theme];
  if (!t || (t.supporter && !supporter)) return systemDark ? dark : light;
  return t.palette;
}
