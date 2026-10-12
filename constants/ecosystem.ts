/**
 * Get the path for an app within the unified kylrix application.
 * All apps are now served from a single domain with route prefixes like /note, /vault, etc.
 */
export function getEcosystemUrl(subdomain: string) {
  if (!subdomain) {
    return '#';
  }

  // Map subdomain to unified app paths
  const appPaths: Record<string, string> = {
    'accounts': '/accounts',
    'note': '/app',
    'vault': '/vault',
    'flow': '/flows',
    'connect': '/connect',
    'id': '/accounts',
    'kylrix': '/'
  };

  return appPaths[subdomain] || '/' + subdomain;
}
