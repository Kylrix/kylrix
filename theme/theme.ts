export type PaletteMode = 'light' | 'dark';

export const THEME_MODES: PaletteMode[] = ['light', 'dark'];

export const themeTokens = {
  light: {
    background: '#F1F5F9',
    surface: '#FFFFFF',
    text: '#0F172A',
    muted: '#475569',
  },
  dark: {
    background: '#000000',
    surface: '#161514',
    text: '#F8FAFC',
    muted: '#9B9691',
  },
} as const;
