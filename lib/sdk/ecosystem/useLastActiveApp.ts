import { useEffect } from 'react';

export type AppName = 'accounts' | 'note' | 'vault' | 'flow' | 'connect';

/**
 * Automatically detect and track the current app in localStorage
 * Call this hook in each app's root layout to ensure lastActiveApp stays current
 */
export function useLastActiveApp(): void {
  useEffect(() => {
    const currentApp = detectCurrentApp();
    if (currentApp) {
      localStorage.setItem('kylrix_last_active_app', currentApp);
    }
  }, []);
}

/**
 * Detect which Kylrix app the user is currently in by parsing window.location
 */
export function detectCurrentApp(): AppName | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname.toLowerCase();

  // Parse: accounts.kylrix.space, accounts.localhost, localhost:3000, etc.
  if (hostname.includes('accounts')) return 'accounts';
  if (hostname.includes('note')) return 'note';
  if (hostname.includes('vault')) return 'vault';
  if (hostname.includes('flow')) return 'flow';
  if (hostname.includes('connect')) return 'connect';

  // Local dev: check port number
  const port = window.location.port;
  if (port === '3000') return 'accounts';
  if (port === '3001') return 'note';
  if (port === '3002') return 'vault';
  if (port === '3003') return 'flow';
  if (port === '3004') return 'connect';

  return null;
}

/**
 * Get the last active app, or default to 'connect' if none found
 */
export function getLastActiveApp(): AppName {
  if (typeof window === 'undefined') return 'connect';
  const saved = localStorage.getItem('kylrix_last_active_app') as AppName | null;
  return saved || 'connect';
}

/**
 * Get the full redirect URL for the last active app dashboard
 * Used in kylrix landing page for auto-redirect on login
 */
export function getLastActiveAppRedirectUrl(baseUrl: string): string {
  const app = getLastActiveApp();
  const baseUri = baseUrl.replace(/\/$/, '');
  
  // Map each app to its dashboard equivalent
  const dashboards: Record<AppName, string> = {
    accounts: '/settings',
    note: '/dashboard',
    vault: '/dashboard',
    flow: '/dashboard',
    connect: '/dashboard',
  };

  return `${baseUri}${dashboards[app]}`;
}
