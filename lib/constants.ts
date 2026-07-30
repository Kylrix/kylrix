import { APPWRITE_CONFIG } from './appwrite/config';


export const APP_BASE_PATHS: Record<string, string> = {
  accounts: '/accounts',
  note: '/app',
  vault: '/vault',
  flow: '/flows',
  connect: '/connect',
  projects: '/workspaces',
  kylrix: '/'};

export const KYLRIX_AUTH_URI =
  typeof window !== 'undefined'
    ? `${window.location.origin}${APP_BASE_PATHS.accounts}`
    : `https://${APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN}.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;


export function getEcosystemUrl(subdomain: string, path = '') {
  if (!subdomain) {
    return '#';
  }

  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  let basePath = '';
  if (normalizedPath) {
    const rawPaths: Record<string, string> = {
      accounts: '/accounts',
      note: '/app',
      vault: '/vault',
      flow: '/flows',
      connect: '/connect',
      projects: '/workspaces',
      kylrix: '/'};
    basePath = rawPaths[subdomain] || `/${subdomain}`;
  } else {
    basePath = APP_BASE_PATHS[subdomain] || `/${subdomain}`;
  }
  return `${basePath}${normalizedPath}`;
}
