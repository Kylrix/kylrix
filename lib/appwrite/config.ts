const DEFAULT_PUBLIC_ENDPOINT = 'https://api.kylrix.space/v1';

function trimTrailingSlash(endpoint: string): string {
    return endpoint.replace(/\/+$/, '');
}

export const APPWRITE_CONFIG = {
    /** Browser/client SDK endpoint (NEXT_PUBLIC). */
    ENDPOINT: trimTrailingSlash(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || DEFAULT_PUBLIC_ENDPOINT),
    /** Server-side SDK endpoint — prefers internal Docker hostname when set. */
    SERVER_ENDPOINT: trimTrailingSlash(
        process.env.APPWRITE_ENDPOINT ||
        process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
        DEFAULT_PUBLIC_ENDPOINT
    ),
    PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '67fe9627001d97e37ef3',
    DATABASE_ID: 'passwordManagerDb', // Consolidated database survivor
    NOTE_DATABASE_ID: 'passwordManagerDb',
    VAULT_DATABASE_ID: 'passwordManagerDb',
    FLOW_DATABASE_ID: 'passwordManagerDb',
    CONNECT_DATABASE_ID: 'passwordManagerDb',
    DATABASES: {
        NOTE: 'passwordManagerDb',
        VAULT: 'passwordManagerDb',
        FLOW: 'passwordManagerDb',
        CONNECT: 'passwordManagerDb',
        CHAT: 'passwordManagerDb',
        PASSWORD_MANAGER: 'passwordManagerDb',
        KYLRIXNOTE: 'passwordManagerDb',
        KYLRIXFLOW: 'passwordManagerDb'
    },
    TABLES: {
        // Flat aliases for common tables
        NOTES: '67ff05f3002502ef239e',
        TAGS: '67ff06280034908cf08a',
        TASKS: 'tasks',
        EVENTS: 'events',
        CALENDARS: 'calendars',
        EVENT_GUESTS: 'eventGuests',
        FOCUS_SESSIONS: 'focusSessions',
        MESSAGES: 'messages',
        PROFILES: 'profiles',
        KEYCHAIN: 'keychain',
        USER_RESOURCE_PINS: 'user_resource_pins',
        OBJECTS: 'objects',
        SESSION_OBJECTS: 'session_objects',
        TOOL_CALLS: 'tool_calls',
        SWEPT: 'swept',
        TOKEN_REGISTRY: 'token_registry',
        WEB3_TRANSACTIONS: 'web3_transactions',
        NOSTR_IDENTITIES: 'nostr_identities',
        AGENT_PAYMENT_INTENTS: 'agent_payment_intents',
        AGENT_BYOK_KEYS: 'agent_byok_keys',
        USER_CONVENIENCE_SESSIONS: 'user_convenience_sessions',
        CONTEXTS: 'contexts',
        KNOWLEDGE_GRAPH: 'knowledge_graph',
        PATTERNS: 'patterns',
        SPONSORSHIPS: 'sponsorships',
        USER_BADGES: 'user_badges',

        NOTE: {
            USERS: '67ff05c900247b5673d3',
            NOTES: '67ff05f3002502ef239e',
            TAGS: '67ff06280034908cf08a',
            APIKEYS: '67ff064400263631ffe4',
            COMMENTS: 'comments',
            EXTENSIONS: 'extensions',
            REACTIONS: 'reactions',
            COLLABORATORS: 'collaborators',
            ACTIVITY_LOG: 'activityLog',
            SETTINGS: 'settings',
            SUBSCRIPTIONS: 'subscriptions',
            COUPONS: 'coupons',
            NOTE_TAGS: 'resource_tags',
            BLOGPOSTS: '67ff065a003e2bb950f7',
            WALLET_MAP: 'walletMap',
            NOTE_REVISIONS: 'note_revisions',
            /** Canonical discussion substrate (not thread notes) */
            THREADS: 'threads',
            THREAD_MESSAGES: 'thread_messages',
            THREAD_REACTIONS: 'thread_reactions',
        },
        KYLRIXNOTE: {
            PROFILES: 'profiles',
            USERS: '67ff05c900247b5673d3',
            ACTIVITY_LOG: 'activityLog',
            WALLET_MAP: 'walletMap',
            NOTE_REVISIONS: 'note_revisions'
        },
        VAULT: {
            CREDENTIALS: 'credentials',
            TOTP_SECRETS: 'totpSecrets',
            FOLDERS: 'folders',
            SECURITY_LOGS: 'securityLogs',
            USER: 'user',
            KEYCHAIN: 'keychain',
            KEY_MAPPING: 'key_mapping',
            WALLETS: 'wallets',
            TOKEN_REGISTRY: 'token_registry',
            WEB3_TRANSACTIONS: 'web3_transactions'
        },
        PASSWORD_MANAGER: {
            KEYCHAIN: 'keychain',
            KEY_MAPPING: 'key_mapping',
            IDENTITIES: 'identities',
            WALLETS: 'wallets',
            TOKEN_REGISTRY: 'token_registry',
            WEB3_TRANSACTIONS: 'web3_transactions'
        },
        FLOW: {
            TASKS: 'tasks',
            EVENTS: 'events',
            GUESTS: 'eventGuests',
            COLLABORATORS: 'Collaborators',
            FORMS: 'forms',
            FORM_SUBMISSIONS: 'formSubmissions',
            AGENTS: 'agents',
            OBJECTS: 'objects',
            AGENT_PAYMENT_INTENTS: 'agent_payment_intents',
            WORKFLOWS: 'workflows',
            FLOW_INSTALLS: 'flow_installs',
            FLOW_REVIEWS: 'flow_reviews',
            PATS: 'pats',
            PAT_RATE_STATE: 'pat_rate_state',
            API_USER_RATE_STATE: 'api_user_rate_state',
            OAUTH_APPS: 'oauth_apps',
            OAUTH_APP_INSTALLS: 'oauth_app_installs',
            OAUTH_CONSENT_REQUESTS: 'oauth_consent_requests'
        },
        CONNECT: {
            USERS: 'users',
            PROFILES: 'profiles',
            REFERRALS: 'referrals',
            CONVERSATIONS: 'conversations',
            CONVERSATION_MEMBERS: 'conversationMembers',
            MESSAGES: 'messages',
            JOIN_REQUESTS: 'joinRequests',
            MESSAGE_REACTIONS: 'messageReactions',
            EPOCHS: 'epochs',
            UNORGANIC_EMAILS: 'unorganic_emails',
            ACCOUNT_EVENTS: 'accountEvents',
            APP_ACTIVITY: 'app_activity',
            FOLLOWS: 'follows',
            MOMENTS: 'moments',
            INTERACTIONS: 'interactions',
            CONTACTS: 'contacts',
            KYLRIX_TOKEN_LEDGER: 'kylrix_token_ledger',
            ENGAGEMENT_VIEWS: 'engagement_views',
            ENGAGEMENT_VIEW_ROLLUPS: 'engagement_view_rollups',
            TELEGRAM_CONNECTIONS: 'telegram_connections',
            SOURCE_CONTROL: 'source_control',
            NOSTR_IDENTITIES: 'nostr_identities'
        },
        // Identical to CONNECT — assigned after object init
        CHAT: null as any},
    BUCKETS: {
        ATTACHMENTS: 'notes_attachments',
        NOTES_ATTACHMENTS: 'notes_attachments',
        PROFILE_PICTURES: 'notes_attachments',
        GROUP_AVATARS: 'notes_attachments',
        GENERAL_STORAGE: 'notes_attachments',
        BLOG_MEDIA: 'notes_attachments',
        EXTENSION_ASSETS: 'notes_attachments',
        BACKUPS: 'notes_attachments',
        TEMP_UPLOADS: 'notes_attachments',
        /** Ephemeral file payloads for Send by Kylrix (TTL ~7d via cron/cleanup). */
        SEND_EPHEMERAL: 'notes_attachments',
        MESSAGES: 'notes_attachments',
        VAULT_ATTACHMENTS: 'notes_attachments',
        FORM_MEDIA: 'notes_attachments',
        FORM_ATTACHMENTS: 'notes_attachments',
        CHAT_UPLOADS: 'notes_attachments',
        TASK_ATTACHMENTS: 'notes_attachments',
        EVENT_COVERS: 'notes_attachments',
        VOICE: 'notes_attachments',
        APP_LOGOS: 'notes_attachments'
    },
    FUNCTIONS: {
        DATA_PORTER: 'data-porter',
        GOAL_REMINDER_DISPATCH: 'goal-reminder-dispatch'
    },
    SYSTEM: {
        DOMAIN: 'kylrix.space',
        AUTH_SUBDOMAIN: 'accounts',
        RP_NAME: 'kylrix',
        RP_ID: 'kylrix.space'
    }
};

// CHAT is a legacy alias of CONNECT (same tables)
(APPWRITE_CONFIG.TABLES as any).CHAT = APPWRITE_CONFIG.TABLES.CONNECT;

export const KYLRIX_AUTH_URI = `https://${APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN}.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;
export const KYLRIX_DOMAIN = APPWRITE_CONFIG.SYSTEM.DOMAIN;
export const KYLRIX_AUTH_SUBDOMAIN = APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN;
