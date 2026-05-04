/**
 * Ecosystem App Color Palette
 * Maps each Kylrix app to its brand identity color and secondary accent
 */

export type EcosystemApp = 'root' | 'accounts' | 'vault' | 'flow' | 'connect' | 'note';

export interface AppColorScheme {
  primary: string;
  secondary: string;
  accent: string;
}

export const ECOSYSTEM_APP_COLORS: Record<string, AppColorScheme> = {
  root: {
    primary: '#6366F1', // Indigo - Root of Trust
    secondary: '#818CF8', // Lighter Indigo
    accent: '#4F46E5', // Darker Indigo
  },
  accounts: {
    primary: '#6366F1', // Indigo - Root of Trust
    secondary: '#818CF8', // Lighter Indigo
    accent: '#4F46E5', // Darker Indigo
  },
  vault: {
    primary: '#10B981', // Emerald - Secure State Store
    secondary: '#34D399', // Lighter Emerald
    accent: '#059669', // Darker Emerald
  },
  flow: {
    primary: '#A855F7', // Amethyst - Action Engine
    secondary: '#D8B4FE', // Lighter Amethyst
    accent: '#9333EA', // Darker Amethyst
  },
  connect: {
    primary: '#F59E0B', // Amber - Communication Relay
    secondary: '#FBBF24', // Lighter Amber
    accent: '#D97706', // Darker Amber
  },
  note: {
    primary: '#EC4899', // Pink - Intelligence Layer
    secondary: '#F472B6', // Lighter Pink
    accent: '#DB2777', // Darker Pink
  },
};

/**
 * Get the color scheme for an ecosystem app
 * @param app The app name
 * @param colorType 'primary' | 'secondary' | 'accent' (defaults to 'primary')
 */
export function getAppColor(
  app: string,
  colorType: keyof AppColorScheme = 'primary'
): string {
  const scheme = ECOSYSTEM_APP_COLORS[app] || ECOSYSTEM_APP_COLORS.root;
  return scheme[colorType];
}

/**
 * Get Connect app secondary color for borrowed/cross-app components
 */
export function getConnectSecondaryColor(): string {
  return ECOSYSTEM_APP_COLORS.connect.secondary;
}

/**
 * Get Connect app primary color for borrowed/cross-app components
 */
export function getConnectPrimaryColor(): string {
  return ECOSYSTEM_APP_COLORS.connect.primary;
}
