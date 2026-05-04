/**
 * Constructs the application origin URL.
 * In the unified architecture, all apps share the same origin.
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://kylrix.space';
}
