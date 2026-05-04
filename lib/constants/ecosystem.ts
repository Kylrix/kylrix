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
        color: '#00F0FF'
    },
    {
        id: 'vault',
        label: 'Kylrix Vault',
        description: 'Passwords and 2FA.',
        subdomain: 'vault',
        icon: '🛡️',
        color: '#FACC15'
    },
    {
        id: 'flow',
        label: 'Kylrix Flow',
        description: 'Tasks and workflows.',
        subdomain: 'flow',
        icon: '🌊',
        color: '#4ADE80'
    },
    {
        id: 'connect',
        label: 'Kylrix Connect',
        description: 'Messages and sharing.',
        subdomain: 'connect',
        icon: '📡',
        color: '#FF00F5'
    },
    {
        id: 'id',
        label: 'Accounts',
        description: 'Account settings.',
        subdomain: KYLRIX_AUTH_SUBDOMAIN,
        icon: '🆔',
        color: '#8B5CF6'
    }
];

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
