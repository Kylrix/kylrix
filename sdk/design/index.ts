/**
 * Shared Kylrix design primitives.
 * Keep this package framework-agnostic and pure.
 */

export type KylrixApp = 'root' | 'accounts' | 'kylrix' | 'vault' | 'flow' | 'note' | 'connect' | 'send' | 'projects';

export const KYLRIX_COLORS = {
  ecosystemPrimary: '#6366F1',
  background: '#0A0908',
  surface: '#161412',
  surfaceHover: '#1C1A18',
  text: '#FFFFFF',
  mutedText: 'rgba(255,255,255,0.56)'} as const;


export const KYLRIX_APP_TONES: Record<KylrixApp, { primary: string; secondary: string; label: string }> = {
  root: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: KYLRIX_COLORS.ecosystemPrimary, label: 'Kylrix' },
  accounts: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: KYLRIX_COLORS.ecosystemPrimary, label: 'Accounts' },
  kylrix: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: KYLRIX_COLORS.ecosystemPrimary, label: 'Kylrix' },
  vault: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#10B981', label: 'Vault' },
  flow: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#A855F7', label: 'Flow' },
  note: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#EC4899', label: 'Note' },
  connect: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#F59E0B', label: 'Connect' },
  send: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#EC4899', label: 'Send' },
  projects: { primary: KYLRIX_COLORS.ecosystemPrimary, secondary: '#6366F1', label: 'Projects' }};


export const TOPBAR_LAYOUT = {
  height: 88,
  searchDockMaxHeight: '50vh',
  panelRadius: '30px',
  pillRadius: '999px'} as const;

export const FAB_LAYOUT = {
  size: 56,
  bottomOffset: 24} as const;

export function getAppTone(app: KylrixApp) {
  return KYLRIX_APP_TONES[app];
}

