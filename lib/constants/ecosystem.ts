export interface EcosystemApp {
    id: string;
    label: string;
    description: string;
    subdomain: string;
    icon: string;
    color: string;
}

export const KYLRIX_DOMAIN = 'kylrix.space';
export const KYLRIX_AUTH_SUBDOMAIN = 'accounts';
export const KYLRIX_AUTH_URI = `https://${KYLRIX_AUTH_SUBDOMAIN}.${KYLRIX_DOMAIN}`;

export const ECOSYSTEM_APPS: EcosystemApp[] = [
    {
        id: 'note',
        label: 'Kylrix Note',
        description: 'Secure notes and research.',
        subdomain: 'note',
        icon: '📝',
        color: '#EC4899'
    },
    {
        id: 'vault',
        label: 'Kylrix Vault',
        description: 'Passwords and 2FA.',
        subdomain: 'vault',
        icon: '🛡️',
        color: '#10B981'
    },
    {
        id: 'flow',
        label: 'Kylrix Flow',
        description: 'Tasks and workflows.',
        subdomain: 'flow',
        icon: '⚡',
        color: '#A855F7'
    },
    {
        id: 'connect',
        label: 'Kylrix Connect',
        description: 'Messages and sharing.',
        subdomain: 'connect',
        icon: '💬',
        color: '#F59E0B'
    },
    {
        id: 'id',
        label: 'Accounts',
        description: 'Account settings.',
        subdomain: KYLRIX_AUTH_SUBDOMAIN,
        icon: '🆔',
        color: '#6366F1'
    }
];

/**
 * Get the path for an app within the unified kylrix application.
 * All apps are now served from a single domain with route prefixes like /note, /vault, etc.
 */
export const getEcosystemUrl = (subdomain: string) => {
    const appBasePaths: Record<string, string> = {
        'accounts': '/accounts',
        'note': '/note',
        'vault': '/vault',
        'flow': '/flow',
        'connect': '/connect',
        'id': '/accounts',
        'kylrix': '/'
    };
    return appBasePaths[subdomain] || '/' + subdomain;
};

