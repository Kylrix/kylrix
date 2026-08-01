import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { OAUTH2_DISCOVERY_URL } from './config';

type Discovery = {
  issuer: string;
  jwks_uri: string;
};

let discoveryCache: { at: number; doc: Discovery } | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getDiscovery(): Promise<Discovery> {
  const now = Date.now();
  if (discoveryCache && now - discoveryCache.at < 10 * 60_000) {
    return discoveryCache.doc;
  }
  const res = await fetch(OAUTH2_DISCOVERY_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status})`);
  }
  const doc = (await res.json()) as Discovery;
  discoveryCache = { at: now, doc };
  jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
  return doc;
}

export type VerifiedOAuthAccess = {
  userId: string;
  clientId: string;
  scopes: string[];
  payload: JWTPayload;
};

/**
 * Verify an Appwrite OAuth2 access token (RS256 JWT) via project JWKS.
 * Access token audience is the project API audience (issuer with /oauth2/ stripped).
 */
export async function verifyOAuthAccessToken(token: string): Promise<VerifiedOAuthAccess | null> {
  try {
    const metadata = await getDiscovery();
    if (!jwks) jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
    const projectAudience = metadata.issuer.replace('/oauth2/', '/');

    const { payload } = await jwtVerify(token, jwks, {
      issuer: metadata.issuer,
      audience: projectAudience,
    });

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) return null;

    const clientId =
      typeof (payload as any).client_id === 'string'
        ? String((payload as any).client_id)
        : '';

    const scopeRaw = typeof payload.scope === 'string' ? payload.scope : '';
    const scopes = scopeRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return { userId: sub, clientId, scopes, payload };
  } catch {
    return null;
  }
}

export function looksLikeJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts[0].startsWith('eyJ');
}
