import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

/** Live OAuth2 server — matches Auth → OAuth2 server in Console. */
export const OAUTH2_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

/** Prefer same endpoint as session cookies (api.kylrix.space). Cloud FRA discovery is equivalent. */
export const OAUTH2_API_BASE = `${APPWRITE_CONFIG.ENDPOINT}/oauth2/${OAUTH2_PROJECT_ID}`;

export const OAUTH2_DISCOVERY_URL =
  process.env.NEXT_PUBLIC_OAUTH2_DISCOVERY_URL ||
  `https://fra.cloud.appwrite.io/v1/oauth2/${OAUTH2_PROJECT_ID}/.well-known/openid-configuration`;

export const OAUTH2_CONSENT_PATH = '/oauth/consent';

/** Built-in OIDC scopes (always available; cannot be removed in Console). */
export const OIDC_LOCKED_SCOPES = ['openid', 'profile', 'email', 'phone'] as const;

/** Custom scopes currently enabled on this project's OAuth2 server. */
export const OAUTH2_CUSTOM_SCOPES = [
  'notes:read',
  'notes:write',
  'goals:read',
  'goals:write',
  'flows:read',
  'profile:read',
] as const;

export const OAUTH2_SCOPE_LABELS: Record<string, { label: string; danger?: boolean }> = {
  openid: { label: 'Confirm who you are' },
  profile: { label: 'See your name and profile' },
  email: { label: 'See your email' },
  phone: { label: 'See your phone number' },
  'notes:read': { label: 'Read your ideas' },
  'notes:write': { label: 'Create and edit ideas' },
  'goals:read': { label: 'Read your goals' },
  'goals:write': { label: 'Create and edit goals' },
  'flows:read': { label: 'Read your flows' },
  'profile:read': { label: 'Read your profile' },
};

export function isLockedOidcScope(scope: string): boolean {
  return (OIDC_LOCKED_SCOPES as readonly string[]).includes(scope);
}

export function scopeLabel(scope: string): string {
  return OAUTH2_SCOPE_LABELS[scope]?.label || scope;
}
