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
  { id: 'accounts', label: 'Accounts', subdomain: KYLRIX_AUTH_SUBDOMAIN, type: 'accounts', icon: 'fingerprint', color: '#6366F1', description: 'Your Kylrix account.' },
];

export const DEFAULT_ECOSYSTEM_LOGO = '/logo/rall.svg';

export function getEcosystemUrl(subdomain: string) {
  if (!subdomain) {
    return '#';
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    const ports: Record<string, number> = {
      accounts: 3000,
      note: 3001,
      vault: 3002,
      flow: 3003,
      connect: 3004,
      kylrix: 3005
    };
    return `http://localhost:${ports[subdomain] || ports['accounts']}`;
  }

  return `https://${subdomain}.${KYLRIX_DOMAIN}`;
}
