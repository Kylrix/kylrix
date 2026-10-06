import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { PAT_SCOPES, PAT_SCOPE_META } from '@/lib/api/scopes';

/** Live OAuth2 server — matches Auth → OAuth2 server in Console. */
export const OAUTH2_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

/** Prefer same endpoint as session cookies (api.kylrix.space). Cloud FRA discovery is equivalent. */
export const OAUTH2_API_BASE = `${APPWRITE_CONFIG.ENDPOINT}/oauth2/${OAUTH2_PROJECT_ID}`;

export const OAUTH2_DISCOVERY_URL =
  process.env.NEXT_PUBLIC_OAUTH2_DISCOVERY_URL ||
  (process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/.well-known/openid-configuration`
    : `https://fra.cloud.appwrite.io/v1/oauth2/${OAUTH2_PROJECT_ID}/.well-known/openid-configuration`);

export const OAUTH2_CONSENT_PATH = '/oauth/consent';

/** Built-in OIDC scopes (always available; cannot be removed in Console). */
export const OIDC_LOCKED_SCOPES = ['openid', 'profile', 'email', 'phone'] as const;

/** Full range of scopes offered across the Kylrix workspace ecosystem. */
export const OAUTH2_CUSTOM_SCOPES = PAT_SCOPES;

export const OAUTH2_SCOPE_LABELS: Record<string, { label: string; danger?: boolean }> = {
  openid: { label: 'Confirm who you are' },
  profile: { label: 'See your name and profile' },
  email: { label: 'See your email' },
  phone: { label: 'See your phone number' },
  offline_access: { label: 'Maintain offline access via refresh tokens' },
  ...PAT_SCOPE_META,
};

export function isLockedOidcScope(scope: string): boolean {
  return (OIDC_LOCKED_SCOPES as readonly string[]).includes(scope);
}

export function scopeLabel(scope: string): string {
  return OAUTH2_SCOPE_LABELS[scope]?.label || scope;
}
