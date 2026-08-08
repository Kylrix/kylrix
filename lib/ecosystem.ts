
interface _EcosystemApp {
  id: string;
  label: string;
  subdomain: string;
  type: 'app' | 'accounts' | 'support';
  icon: string;
  logo: string;
  color: string;
  description: string;
}

const APP_BASE_PATHS: Record<string, string> = {
  accounts: '/accounts',
  note: '/app',
  vault: '/vault',
  flow: '/flows',
  connect: '/connect',
  projects: '/app',
  kylrix: '/',
  send: '/app'};



export function getEcosystemUrl(subdomain: string, path = '') {
  if (!subdomain) {
    return '#';
  }

  // Always use path-based routing in unified app (same-origin)
  // Regardless of localhost or production
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  let basePath = '';
  if (normalizedPath) {
    const rawPaths: Record<string, string> = {
      accounts: '/accounts',
      note: '/app',
      vault: '/vault',
      flow: '/flows',
      connect: '/connect',
      projects: '/app',
      kylrix: '/'};
    basePath = rawPaths[subdomain] || `/${subdomain}`;
  } else {
    basePath = APP_BASE_PATHS[subdomain] || `/${subdomain}`;
  }
  return `${basePath}${normalizedPath}`;
}
