import { APPWRITE_CONFIG } from "./appwrite/config";

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

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  { id: 'note', label: 'Note', subdomain: 'note', type: 'app', icon: 'file-text', color: '#EC4899', description: 'Secure notes and research.' },
  { id: 'vault', label: 'Vault', subdomain: 'vault', type: 'app', icon: 'shield', color: '#10B981', description: 'Passwords, 2FA, and keys.' },
  { id: 'flow', label: 'Flow', subdomain: 'flow', type: 'app', icon: 'zap', color: '#A855F7', description: 'Tasks and workflows.' },
  { id: 'connect', label: 'Connect', subdomain: 'connect', type: 'app', icon: 'waypoints', color: '#F59E0B', description: 'Secure messages and sharing.' },
  { id: 'accounts', label: 'Accounts', subdomain: 'accounts', type: 'accounts', icon: 'fingerprint', color: '#6366F1', description: 'Your Kylrix account.' },
];

export function getEcosystemUrl(subdomain: string) {
  if (!subdomain) {
    return '#';
  }

  if (typeof window === 'undefined') {
    return `https://${subdomain}.kylrix.space`;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    const ports: Record<string, number> = {
      accounts: 3000,
      note: 3001,
      vault: 3002,
      flow: 3003,
      connect: 3004
    };
    const subdomainToAppId: Record<string, string> = {
      app: 'note',
      id: 'accounts',
      keep: 'vault'
    };
    const appId = subdomainToAppId[subdomain] || subdomain;
    return `http://localhost:${ports[appId] || 3000}`;
  }

  return `https://${subdomain}.kylrix.space`;
}
