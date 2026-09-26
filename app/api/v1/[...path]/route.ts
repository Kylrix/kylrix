import { NextRequest } from 'next/server';
import { withApiGuard } from '@/lib/api/guard';
import { dispatchV1 } from '@/lib/api/v1/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  
  // CLI / REST Unauthenticated Auth (Sign up & Sign in with email/password -> PAT)
  // POST /api/v1/auth/signup, POST /api/v1/auth/signin, GET /api/v1/auth/status
  if (path[0] === 'auth' && (path[1] === 'signup' || path[1] === 'register' || path[1] === 'signin' || path[1] === 'login' || path[1] === 'status' || !path[1])) {
    const { handleAuthUnauthenticated } = await import('@/lib/api/v1/auth-handler');
    return handleAuthUnauthenticated(req, path);
  }

  // RFC 8628 Device Authorization / Punch Grant:
  // /api/v1/pairing/* (request, exchange, verify, approve) handles initiation, polling, and web approval
  if (path[0] === 'pairing') {
    const { handlePairingUnauthenticated } = await import('@/lib/api/v1/pairing-handler');
    return handlePairingUnauthenticated(req, path);
  }

  // Public / Shared Vault Secrets (Unauthenticated Zero-Auth Bootstrap)
  // GET /api/v1/vault/public/:id or GET /api/v1/public/vault/:id
  if (
    (path[0] === 'vault' && path[1] === 'public' && path[2]) ||
    (path[0] === 'public' && path[1] === 'vault' && path[2])
  ) {
    const secretId = path[2];
    const shareKey =
      req.headers.get('x-share-key') ||
      req.headers.get('X-Share-Key') ||
      req.nextUrl.searchParams.get('shareKey') ||
      req.nextUrl.searchParams.get('key') ||
      (path[3] ? path[3] : null);
    const format = req.nextUrl.searchParams.get('format');
    const pure = req.nextUrl.searchParams.get('pure') === 'true';

    try {
      const { ApiResources } = await import('@/lib/api/resources');
      const result = await ApiResources.getPublicVaultItem(secretId, {
        shareKey,
        format,
        pure,
      });
      if (format === 'env' && req.headers.get('accept') === 'text/plain') {
        return new Response((result as any).envText || '', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const { jsonOk } = await import('@/lib/api/guard');
      return jsonOk(result);
    } catch (err: any) {
      const status = err?.status || (err?.message?.includes('not found') ? 404 : 400);
      return Response.json({ error: err?.message || 'Failed to resolve public secret' }, { status });
    }
  }

  return withApiGuard(req, (actor) => dispatchV1(req, path, actor));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
