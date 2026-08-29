"use client";

type AppName = 'accounts' | 'note' | 'vault' | 'flow' | 'connect';

/**
 * Automatically detect and track the current app in localStorage
 * Call this hook in each app's root layout to ensure lastActiveApp stays current
 */

/**
 * Detect which Kylrix app the user is currently in by parsing window.location
 */

/**
 * Get the last active app, or default to 'connect' if none found
 */
function getLastActiveApp(): AppName {
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
    accounts: '/accounts/settings/profile',
    note: '/app',
    vault: '/vault',
    flow: '/flow',
    connect: '/connect'};

  return `${baseUri}${dashboards[app]}`;
}
