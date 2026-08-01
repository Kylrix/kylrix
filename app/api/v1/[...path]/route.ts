import { NextRequest } from 'next/server';
import { withApiGuard, jsonOk, requireScope, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public HTTP API for Personal Access Tokens.
 *
 * Auth: Authorization: Bearer kyl_pat_<prefix>_<secret>
 *
 * Routes:
 *   GET  /api/v1/me
 *   GET  /api/v1/notes
 *   GET  /api/v1/notes/:id
 *   GET  /api/v1/goals
 *   GET  /api/v1/flows
 *   POST /api/v1/tools/execute  { toolId, params }
 */
async function dispatch(req: NextRequest, parts: string[], actor: ApiActor) {
  const method = req.method.toUpperCase();
  const [a, b, c] = parts;

  if (method === 'GET' && a === 'me' && !b) {
    return jsonOk(await ApiResources.me(actor));
  }

  if (method === 'GET' && a === 'notes' && !b) {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listNotes(actor, limit));
  }

  if (method === 'GET' && a === 'notes' && b && !c) {
    return jsonOk(await ApiResources.getNote(actor, b));
  }

  if (method === 'GET' && a === 'goals' && !b) {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listGoals(actor, limit));
  }

  if (method === 'GET' && a === 'flows' && !b) {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listFlows(actor, limit));
  }

  if (method === 'POST' && a === 'tools' && b === 'execute' && !c) {
    requireScope(actor, 'tools:execute');
    const body = await req.json().catch(() => ({}));
    const toolId = String(body?.toolId || '').trim();
    if (!toolId) {
      const err = new Error('toolId required');
      (err as any).status = 400;
      throw err;
    }
    const result = await ApiResources.executeTool(
      actor,
      toolId,
      body?.params && typeof body.params === 'object' ? body.params : {}
    );
    return jsonOk(result);
  }

  const err = new Error('Not found');
  (err as any).status = 404;
  (err as any).code = 'not_found';
  throw err;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  return withApiGuard(req, (actor) => dispatch(req, path, actor));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
