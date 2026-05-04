/**
 * Constructs the application origin URL from environment variables.
 * Supports flexible format with or without http protocol prefix.
 */
export function getAppOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  const subdomain = process.env.NEXT_PUBLIC_APP_ORIGIN_DEFAULT || 'app';

  if (!origin) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      
      if (parts.length >= 2) {
        const domain = parts.slice(-2).join('.');
        return `https://${subdomain}.${domain}`;
      }
      
      return `https://${subdomain}.${hostname}`;
    }
    
    return `https://${subdomain}.localhost:3000`;
  }

  // Remove protocol if present
  const cleanOrigin = origin.replace(/^https?:\/\//, '');

  // Construct the full URL
  const fullUrl = `${subdomain}.${cleanOrigin}`;

  // Ensure protocol
  if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
    return fullUrl;
  }

  return `https://${fullUrl}`;
}
