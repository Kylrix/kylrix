/**
 * Shared Kylrix design primitives.
 * Keep this package framework-agnostic and pure.
 */

export type KylrixApp = 'root' | 'vault' | 'flow' | 'note' | 'connect';

export const KYLRIX_COLORS = {
  ecosystemPrimary: '#6366F1',
  background: '#0A0908',
  surface: '#161412',
  surfaceHover: '#1C1A18',
  text: '#FFFFFF',
  mutedText: 'rgba(255,255,255,0.56)',
} as const;

export const KYLRIX_TYPOGRAPHY = {
  headings: 'Clash Display',
  ui: 'Satoshi',
  technical: 'JetBrains Mono',
} as const;

export const KYLRIX_APP_TONES: Record<KylrixApp, { primary: string; secondary: string; label: string }> = {
  root: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: KYLRIX_COLORS.ecosystemPrimary, label: 'Kylrix' },
  vault: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#10B981', label: 'Vault' },
  flow: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#A855F7', label: 'Flow' },
  note: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#EC4899', label: 'Note' },
  connect: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#F59E0B', label: 'Connect' },
};

export const KYLRIX_THEME = {
  BRAND: {
    PRIMARY: KYLRIX_COLORS.ecosystemPrimary,
    CREAMY: '#FDFCFB',
    GLASS: 'rgba(255, 255, 255, 0.7)',
  },
  TYPOGRAPHY: KYLRIX_TYPOGRAPHY,
  VIRTUAL_WINDOW: {
    BLUR: '12px',
    BORDER_RADIUS: '16px',
  },
} as const;

export const TOPBAR_LAYOUT = {
  height: 88,
  searchDockMaxHeight: '50vh',
  panelRadius: '30px',
  pillRadius: '999px',
} as const;

export const FAB_LAYOUT = {
  size: 56,
  bottomOffset: 24,
} as const;

export function getAppTone(app: KylrixApp) {
  return KYLRIX_APP_TONES[app];
}

export function getAppLabel(app: KylrixApp) {
  return KYLRIX_APP_TONES[app].label;
}
