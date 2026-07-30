/**
 * Shared ecosystem discovery helpers.
 */

export * from './useLastActiveApp';

const ECOSYSTEM_CONFIG = {
  DOMAIN: 'kylrix.space',
  SUBDOMAINS: {
    ACCOUNTS: 'accounts',
    VAULT: 'vault',
    NOTE: 'note',
    FLOW: 'flow',
    CONNECT: 'connect',
  },
  DEFAULT_ENDPOINT: 'https://cloud.appwrite.io/v1',
} as const;


