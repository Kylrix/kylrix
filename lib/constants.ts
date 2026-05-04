import { APPWRITE_CONFIG } from './appwrite/config';

export interface EcosystemApp {
  id: string;
  label: string;
  subdomain: string;
  type: 'app' | 'accounts' | 'support';
  icon: string;
  color: string;
  description: string;
}

export const NEXT_PUBLIC_DOMAIN = APPWRITE_CONFIG.SYSTEM?.DOMAIN || 'kylrix.space';
export const APP_BASE_PATHS: Record<string, string> = {
  accounts: '/accounts',
  note: '/note',
  vault: '/vault',
  flow: '/flow',
  connect: '/connect',
  kylrix: '/',
};

export const KYLRIX_AUTH_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}${APP_BASE_PATHS.accounts}`
    : `https://${APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN}.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  { id: 'note', label: 'Note', subdomain: 'note', type: 'app', icon: 'file-text', color: '#EC4899', description: 'Secure notes and research.' },
  { id: 'vault', label: 'Vault', subdomain: 'vault', type: 'app', icon: 'shield', color: '#10B981', description: 'Passwords, 2FA, and keys.' },
  { id: 'flow', label: 'Flow', subdomain: 'flow', type: 'app', icon: 'zap', color: '#A855F7', description: 'Tasks and workflows.' },
  { id: 'connect', label: 'Connect', subdomain: 'connect', type: 'app', icon: 'waypoints', color: '#F59E0B', description: 'Secure messages and sharing.' },
  { id: 'accounts', label: 'Accounts', subdomain: 'accounts', type: 'accounts', icon: 'fingerprint', color: '#6366F1', description: 'Your Kylrix account.' },
];

export function getEcosystemUrl(subdomain: string, path = '') {
  if (!subdomain) {
    return '#';
  }

  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  const basePath = APP_BASE_PATHS[subdomain] || `/${subdomain}`;
  return `${basePath}${normalizedPath}`;
}
