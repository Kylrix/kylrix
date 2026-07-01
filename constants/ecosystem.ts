export interface EcosystemApp {
  id: string;
  label: string;
  subdomain: string;
  type: 'app' | 'accounts' | 'support';
  icon: string;
  color: string;
  description: string;
}

export const KYLRIX_DOMAIN = 'kylrix.space';
export const KYLRIX_AUTH_SUBDOMAIN = 'accounts';
export const KYLRIX_AUTH_URI = `https://${KYLRIX_AUTH_SUBDOMAIN}.${KYLRIX_DOMAIN}`;

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  { id: 'note', label: 'Note', subdomain: 'note', type: 'app', icon: 'file-text', color: '#EC4899', description: 'Secure notes and research.' },
  { id: 'vault', label: 'Vault', subdomain: 'vault', type: 'app', icon: 'shield', color: '#10B981', description: 'Passwords, 2FA, and keys.' },
  { id: 'flow', label: 'Flow', subdomain: 'flow', type: 'app', icon: 'zap', color: '#A855F7', description: 'Tasks and workflows.' },
  { id: 'connect', label: 'Connect', subdomain: 'connect', type: 'app', icon: 'waypoints', color: '#F59E0B', description: 'Secure messages and sharing.' },
  { id: 'accounts', label: 'Accounts', subdomain: KYLRIX_AUTH_SUBDOMAIN, type: 'accounts', icon: 'fingerprint', color: '#6366F1', description: 'Your Kylrix account.' }];

export const DEFAULT_ECOSYSTEM_LOGO = '/logo/rall.svg';

/**
 * Get the path for an app within the unified kylrix application.
 * All apps are now served from a single domain with route prefixes like /note, /vault, etc.
 */
export function getEcosystemUrl(subdomain: string) {
  if (!subdomain) {
    return '#';
  }

  // Map subdomain to unified app paths
  const appPaths: Record<string, string> = {
    'accounts': '/accounts',
    'note': '/app',
    'vault': '/vault',
    'flow': '/flow',
    'connect': '/connect',
    'id': '/accounts',
    'kylrix': '/'
  };

  return appPaths[subdomain] || '/' + subdomain;
}

