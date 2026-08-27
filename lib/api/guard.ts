import { NextRequest, NextResponse } from 'next/server';
import { PatService } from '@/lib/services/pats';
import { enforceApiRateLimits, RateLimitError, type ApiRateLimits } from '@/lib/api/rate-limits';
import { assertScope, type PatScope } from '@/lib/api/scopes';
import { getActor } from '@/lib/actions/secure-ops';
import { looksLikeJwt, verifyOAuthAccessToken } from '@/lib/oauth2/verify-access-token';

export type ApiActor = {
  userId: string;
  kind: 'pat' | 'oauth' | 'session';
  patId?: string;
  clientId?: string;
  scopes: string[];
  rateLimits?: ApiRateLimits;
};

function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function resolveApiActor(req: NextRequest): Promise<ApiActor> {
  const bearer = extractBearer(req);
  if (!bearer) {
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
      const err = new Error('Invalid or revoked personal access token');
      (err as any).status = 401;
      (err as any).code = 'invalid_pat';
      throw err;
    }
    const { limits } = await enforceApiRateLimits({
      userId: verified.userId,
      patId: verified.pat.$id,
    });
    return {
      userId: verified.userId,
      kind: 'pat',
      patId: verified.pat.$id,
      scopes: verified.scopes,
      rateLimits: limits,
    };
  }

  // Appwrite OAuth2 access token (Sign in with Kylrix)
  if (looksLikeJwt(bearer)) {
    const oauth = await verifyOAuthAccessToken(bearer);
    if (oauth) {
      const { limits } = await enforceApiRateLimits({
        userId: oauth.userId,
        patId: `oauth_${(oauth.clientId || 'client').slice(0, 28)}`,
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
    const err = new Error('Invalid credentials');
    (err as any).status = 401;
    (err as any).code = 'unauthorized';
    throw err;
  }
  const { limits } = await enforceApiRateLimits({
    userId: actor.$id,
    patId: `sess_${actor.$id}`.slice(0, 36),
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
  assertScope(actor.scopes, scope);
}

export function jsonOk(data: unknown, init?: ResponseInit, actor?: ApiActor) {
  const headers = new Headers(init?.headers);
  if (actor?.rateLimits) {
    headers.set('X-RateLimit-Limit-Minute', String(actor.rateLimits.perMinute));
    headers.set('X-RateLimit-Remaining-Minute', String(actor.rateLimits.remainingMinute));
    headers.set('X-RateLimit-Limit-Day', String(actor.rateLimits.perDay));
    headers.set('X-RateLimit-Remaining-Day', String(actor.rateLimits.remainingDay));
    headers.set('X-RateLimit-Reset-Minute', String(actor.rateLimits.resetMinuteEpoch));
    headers.set('X-RateLimit-Reset-Day', String(actor.rateLimits.resetDayEpoch));
  }
  return NextResponse.json({ ok: true, data }, { status: 200, ...init, headers });
}

export function jsonErr(err: unknown) {
  const e = err as any;
  const status = typeof e?.status === 'number' ? e.status : 500;
  const headers: Record<string, string> = {};
  if (e instanceof RateLimitError || e?.code === 'rate_limit_exceeded') {
    headers['Retry-After'] = String(e.retryAfterSec || 60);
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
    if (cl > 256_000) {
      const err = new Error('Payload too large (maximum 256 KB)');
      (err as any).status = 413;
      throw err;
    }
    const actor = await resolveApiActor(req);
    const res = await handler(actor);
    if (actor.rateLimits) {
      res.headers.set('X-RateLimit-Limit-Minute', String(actor.rateLimits.perMinute));
      res.headers.set('X-RateLimit-Remaining-Minute', String(actor.rateLimits.remainingMinute));
      res.headers.set('X-RateLimit-Limit-Day', String(actor.rateLimits.perDay));
      res.headers.set('X-RateLimit-Remaining-Day', String(actor.rateLimits.remainingDay));
      res.headers.set('X-RateLimit-Reset-Minute', String(actor.rateLimits.resetMinuteEpoch));
      res.headers.set('X-RateLimit-Reset-Day', String(actor.rateLimits.resetDayEpoch));
    }
    return res;
  } catch (err) {
    return jsonErr(err);
  }
}
