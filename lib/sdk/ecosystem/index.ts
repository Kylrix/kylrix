/**
 * Shared ecosystem discovery helpers.
 */

export * from './useLastActiveApp';

export const ECOSYSTEM_CONFIG = {
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

export function getEcosystemUrl(subdomain: keyof typeof ECOSYSTEM_CONFIG.SUBDOMAINS, path: string = ''): string {
  const sub = ECOSYSTEM_CONFIG.SUBDOMAINS[subdomain];
  const url = `https://${sub}.${ECOSYSTEM_CONFIG.DOMAIN}`;
  return path ? `${url}${path.startsWith('/') ? path : `/${path}`}` : url;
}

export const TABLE_DB = {
  getEventPath: (databaseId: string, tableId: string, rowId?: string) => {
    return `databases.${databaseId}.tables.${tableId}${rowId ? `.rows.${rowId}` : '.rows'}`;
  },
};
