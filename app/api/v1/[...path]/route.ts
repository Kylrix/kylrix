import { NextRequest } from 'next/server';
import { withApiGuard } from '@/lib/api/guard';
import { dispatchV1 } from '@/lib/api/v1/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  
  // RFC 8628 Device Authorization / Punch Grant:
  // /api/v1/pairing/request and /api/v1/pairing/exchange are unauthenticated initiation & poll endpoints.
  if (path[0] === 'pairing' && (path[1] === 'request' || path[1] === 'exchange')) {
    const { handlePairingUnauthenticated } = await import('@/lib/api/v1/pairing-handler');
    return handlePairingUnauthenticated(req, path);
  }

  return withApiGuard(req, (actor) => dispatchV1(req, path, actor));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
