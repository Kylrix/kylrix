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
  { id: 'note', label: 'Note', subdomain: 'note', type: 'app', icon: 'file-text', logo: '/logo/rall.svg', color: '#00F5FF', description: 'Cognitive extension and smart notes.' },
  { id: 'vault', label: 'Vault', subdomain: 'vault', type: 'app', icon: 'shield', logo: '/logo/rall.svg', color: '#8b5cf6', description: 'Secure vault and identity vault.' },
  { id: 'flow', label: 'Flow', subdomain: 'flow', type: 'app', icon: 'zap', logo: '/logo/rall.svg', color: '#10b981', description: 'Intelligent task orchestration.' },
  { id: 'connect', label: 'Connect', subdomain: 'connect', type: 'app', icon: 'waypoints', logo: '/logo/rall.svg', color: '#ec4899', description: 'Secure bridge for communication.' },
  { id: 'id', label: 'Accounts', subdomain: KYLRIX_AUTH_SUBDOMAIN, type: 'accounts', icon: 'fingerprint', logo: '/logo/rall.svg', color: '#ef4444', description: 'Sovereign identity management.' },
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
      connect: 3004
    };
    
    const appId = subdomain === 'id' ? 'accounts' : subdomain;
    return `http://localhost:${ports[appId] || 3000}`;
  }

  return `https://${subdomain}.${KYLRIX_DOMAIN}`;
}
