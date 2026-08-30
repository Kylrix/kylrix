import { NextRequest } from 'next/server';
import { withApiGuard } from '@/lib/api/guard';
import { dispatchV1 } from '@/lib/api/v1/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  return withApiGuard(req, (actor) => dispatchV1(req, path, actor));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
