import { NextRequest, NextResponse } from 'next/server';
import { PatService } from '@/lib/services/pats';
import { enforceApiRateLimits, RateLimitError, type ApiRateLimits } from '@/lib/api/rate-limits';
import {
  assertShieldAllowed,
  EdgeShieldError,
  enforceApiAnonShield,
  enforcePatBurstShield,
} from '@/lib/api/edge-shield';
import { assertScope, type PatScope } from '@/lib/api/scopes';
import { getActor } from '@/lib/actions/secure-ops';
import { looksLikeJwt, verifyOAuthAccessToken } from '@/lib/oauth2/verify-access-token';

export const MAX_API_BODY_BYTES = 256_000;

export type ApiActor = {
  userId: string;
  kind: 'pat' | 'oauth' | 'session';
  patId?: string;
  clientId?: string;
  category?: string;
  agentId?: string | null;
  isAgent?: boolean;
  workspaceId?: string | null;
  scopes: string[];
  rateLimits?: ApiRateLimits;
};

function applyRateLimitHeaders(headers: Headers, limits: ApiRateLimits) {
  headers.set('X-RateLimit-Limit-Minute', String(limits.perMinute));
  headers.set('X-RateLimit-Remaining-Minute', String(limits.remainingMinute));
  headers.set('X-RateLimit-Limit-Day', String(limits.perDay));
  headers.set('X-RateLimit-Remaining-Day', String(limits.remainingDay));
  headers.set('X-RateLimit-Reset-Minute', String(limits.resetMinuteEpoch));
  headers.set('X-RateLimit-Reset-Day', String(limits.resetDayEpoch));

  // IETF draft rate limit headers (minute window is primary for client backoff)
  headers.set('RateLimit-Policy', `${limits.perMinute};w=60, ${limits.perDay};w=86400`);
  headers.set('RateLimit-Limit', String(limits.perMinute));
  headers.set('RateLimit-Remaining', String(limits.remainingMinute));
  headers.set(
    'RateLimit-Reset',
    String(Math.max(1, limits.resetMinuteEpoch - Math.floor(Date.now() / 1000))),
  );
}

function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function resolveApiActor(req: NextRequest): Promise<ApiActor> {
  const bearer = extractBearer(req);
  if (!bearer) {
    assertShieldAllowed(enforceApiAnonShield(req));
    const err = new Error('Missing Authorization Bearer token');
    (err as any).status = 401;
    (err as any).code = 'unauthorized';
    throw err;
  }

  if (
    bearer.startsWith('kyl_pat_') ||
    bearer.startsWith('kyl_apat_') ||
    bearer.startsWith('kyl_apk_') ||
    bearer.startsWith('kyl_wpat_') ||
    bearer.startsWith('pat_')
  ) {
    const verified = await PatService.verifyBearer(bearer);
    if (!verified) {
      assertShieldAllowed(enforceApiAnonShield(req));
      const err = new Error('Invalid or revoked personal access token');
      (err as any).status = 401;
      (err as any).code = 'invalid_pat';
      throw err;
    }
    assertShieldAllowed(enforcePatBurstShield(verified.pat.$id));
    const { limits } = await enforceApiRateLimits({
      userId: verified.userId,
      patId: verified.pat.$id,
    });

    const isWs = verified.pat.isWorkspace === true || String(verified.pat.isWorkspace) === 'true';
    const isAgent = (verified.pat as any).category === 'agentic_pat' || (verified.pat as any).category === 'agent_provisioning_key' || !!(verified.pat as any).agentId;

    return {
      userId: verified.userId,
      kind: 'pat',
      patId: verified.pat.$id,
      category: (verified.pat as any).category || (isWs ? 'workspace_pat' : isAgent ? 'agentic_pat' : 'user_pat'),
      agentId: (verified.pat as any).agentId || null,
      isAgent,
      workspaceId: verified.pat.workspaceId || null,
      scopes: verified.scopes,
      rateLimits: limits,
    };
  }

  // Appwrite OAuth2 access token (Sign in with Kylrix)
  if (looksLikeJwt(bearer)) {
    const oauth = await verifyOAuthAccessToken(bearer);
    if (oauth) {
      const oauthPatKey = `oauth_${(oauth.clientId || 'client').slice(0, 28)}`;
      assertShieldAllowed(enforcePatBurstShield(oauthPatKey));
      const { limits } = await enforceApiRateLimits({
        userId: oauth.userId,
        patId: oauthPatKey,
      });
      return {
        userId: oauth.userId,
        kind: 'oauth',
        clientId: oauth.clientId,
        scopes: oauth.scopes,
        rateLimits: limits,
      };
    }
  }

  // Session JWT path (for future clients) — still rate-limited via synthetic pat bucket id
  const actor = await getActor(bearer).catch(() => null);
  if (!actor?.$id) {
    assertShieldAllowed(enforceApiAnonShield(req));
    const err = new Error('Invalid credentials');
    (err as any).status = 401;
    (err as any).code = 'unauthorized';
    throw err;
  }
  const sessionPatKey = `sess_${actor.$id}`.slice(0, 36);
  assertShieldAllowed(enforcePatBurstShield(sessionPatKey));
  const { limits } = await enforceApiRateLimits({
    userId: actor.$id,
    patId: sessionPatKey,
  });
  return {
    userId: actor.$id,
    kind: 'session',
    scopes: [...(await import('@/lib/api/scopes')).PAT_SCOPES],
    rateLimits: limits,
  };
}

export function requireScope(actor: ApiActor, scope: PatScope) {
  if (actor.kind === 'session') return;
  // Agentic workspace policy: allow reading and creating tags by default so agents can discover and tag resources
  if ((scope === 'tags:read' || scope === 'tags:write') && actor.isAgent) {
    return;
  }
  assertScope(actor.scopes, scope);
}

export function jsonOk(data: unknown, init?: ResponseInit, actor?: ApiActor) {
  const headers = new Headers(init?.headers);
  if (actor?.rateLimits) {
    applyRateLimitHeaders(headers, actor.rateLimits);
  }
  return NextResponse.json({ ok: true, data }, { status: 200, ...init, headers });
}

export function jsonErr(err: unknown) {
  const e = err as any;
  const status = typeof e?.status === 'number' ? e.status : 500;
  const headers: Record<string, string> = {};
  if (e instanceof RateLimitError || e?.code === 'rate_limit_exceeded') {
    const retryAfter = String(e.retryAfterSec || 60);
    headers['Retry-After'] = retryAfter;
    headers['RateLimit-Remaining'] = '0';
    headers['RateLimit-Reset'] = retryAfter;
    return NextResponse.json(
      {
        error: e?.code || 'rate_limit_exceeded',
        message: e?.message || 'Rate limit exceeded.',
        type: e?.type || 'per_minute',
        reset_at: e?.resetAt || Math.floor((Date.now() + 60000) / 1000),
      },
      { status: 429, headers }
    );
  }
  if (e instanceof EdgeShieldError || e?.code === 'edge_rate_limited') {
    headers['Retry-After'] = String(e.retryAfterSec || 60);
    return NextResponse.json(
      {
        error: 'edge_rate_limited',
        message: e?.message || 'Too many requests.',
        reason: e?.reason || 'burst',
        tier: e?.tier || 'edge',
      },
      { status: 429, headers },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: e?.code || 'internal_error',
        message: e?.message || 'Request failed',
      },
    },
    { status, headers }
  );
}

export async function withApiGuard(
  req: NextRequest,
  handler: (actor: ApiActor) => Promise<NextResponse>
) {
  try {
    // Hard method / size gates
    const cl = Number(req.headers.get('content-length') || 0);
    if (cl > MAX_API_BODY_BYTES) {
      const err = new Error('Payload too large (maximum 256 KB)');
      (err as any).status = 413;
      throw err;
    }
    const actor = await resolveApiActor(req);
    const res = await handler(actor);
    if (actor.rateLimits) {
      applyRateLimitHeaders(res.headers, actor.rateLimits);
    }
    return res;
  } catch (err) {
    return jsonErr(err);
  }
}
