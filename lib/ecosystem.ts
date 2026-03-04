import { LayoutDashboard, Lock, MessageSquare, Terminal, StickyNote, ShieldCheck, Zap, Fingerprint, FileText, Shield, Waypoints } from 'lucide-react';

export interface EcosystemApp {
  id: string;
  label: string;
  subdomain: string;
  type: 'app' | 'accounts' | 'support';
  icon: string;
  logo: string;
  color: string;
  description: string;
}

export const KYLRIX_DOMAIN = 'kylrix.space';
export const KYLRIX_AUTH_SUBDOMAIN = 'accounts';
export const KYLRIX_AUTH_URI = `https://${KYLRIX_AUTH_SUBDOMAIN}.${KYLRIX_DOMAIN}`;

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  { id: 'note', label: 'Note', subdomain: 'note', type: 'app', icon: 'file-text', logo: '/logo/rall.svg', color: '#F59E0B', description: 'Secure notes and research.' },
  { id: 'vault', label: 'Vault', subdomain: 'vault', type: 'app', icon: 'shield', logo: '/logo/rall.svg', color: '#A855F7', description: 'Passwords, 2FA, and keys.' },
  { id: 'flow', label: 'Flow', subdomain: 'flow', type: 'app', icon: 'zap', logo: '/logo/rall.svg', color: '#10B981', description: 'Tasks and workflows.' },
  { id: 'connect', label: 'Connect', subdomain: 'connect', type: 'app', icon: 'waypoints', logo: '/logo/rall.svg', color: '#F43F5E', description: 'Secure messages and sharing.' },
  { id: 'accounts', label: 'Accounts', subdomain: KYLRIX_AUTH_SUBDOMAIN, type: 'accounts', icon: 'fingerprint', logo: '/logo/rall.svg', color: '#00F5FF', description: 'Your Kylrix account.' },
];

export function getEcosystemUrl(subdomain: string) {
  if (!subdomain) {
    return '#';
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.') || hostname.includes('10.');

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
