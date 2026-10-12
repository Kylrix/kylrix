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
  // 1. Direct Better Auth OAuth access token check in Turso
  try {
    const { db } = await import('@/lib/db');
    const { oauthAccessToken } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const [row] = await db
      .select()
      .from(oauthAccessToken)
      .where(eq(oauthAccessToken.token, token))
      .limit(1);

    if (row && !row.revoked) {
      const isExpired = row.expiresAt ? row.expiresAt.getTime() < Date.now() : false;
      if (!isExpired && row.userId) {
        let scopes: string[] = [];
        try {
          scopes =
            typeof row.scopes === 'string'
              ? JSON.parse(row.scopes)
              : Array.isArray(row.scopes)
                ? row.scopes
                : [];
        } catch {
          scopes = String(row.scopes || '')
            .split(/\s+/)
            .filter(Boolean);
        }
        return {
          userId: row.userId,
          clientId: row.clientId,
          scopes,
          payload: { sub: row.userId, client_id: row.clientId, scope: scopes.join(' ') },
        };
      }
    }
  } catch {
    // Continue to JWT verification
  }

  // 2. Direct Better Auth JWKS verification for signed JWT tokens
  try {
    const { db } = await import('@/lib/db');
    const { jwks: jwksTable } = await import('@/lib/db/schema');
    const [keyRow] = await db.select().from(jwksTable).limit(1);
    if (keyRow?.publicKey) {
      const { importJWK } = await import('jose');
      const parsedKey = JSON.parse(keyRow.publicKey);
      const key = await importJWK(parsedKey, parsedKey.alg || 'RS256');
      const { payload } = await jwtVerify(token, key);
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (sub) {
        const clientId =
          typeof (payload as any).client_id === 'string' ? String((payload as any).client_id) : '';
        const scopeRaw = typeof payload.scope === 'string' ? payload.scope : '';
        const scopes = scopeRaw
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        return { userId: sub, clientId, scopes, payload };
      }
    }
  } catch {
    // Continue to legacy discovery
  }

  // 3. Fallback to Appwrite / legacy discovery JWKS
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
