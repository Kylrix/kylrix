/**
 * Ecosystem App Color Palette
 * Maps each Kylrix app to its brand identity color and secondary accent
 */

export interface AppColorScheme {
  primary: string;
  secondary: string;
  accent: string;
}

const ECOSYSTEM_APP_COLORS: Record<string, AppColorScheme> = {
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
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#4F46E5',
  },
  flow: {
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#4F46E5',
  },
  connect: {
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#4F46E5',
  },
  note: {
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#4F46E5',
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
