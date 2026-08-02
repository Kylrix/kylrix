import { NextRequest } from 'next/server';
import { withApiGuard, jsonOk, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public HTTP API for PATs and Sign-in-with-Kylrix OAuth access tokens.
 *
 * Auth:
 *   Authorization: Bearer kyl_pat_<id>_<secret>
 *   Authorization: Bearer <oauth2_access_jwt>
 *
 * REST resource surface — expand toward UI parity. Tools stay in-process
 * (POST /tools → 410) except where a resource route wraps the same capability.
 *
 * Token self-service (rescue hatch, no extra scope):
 *   GET    /api/v1/token
 *   GET    /api/v1/token/scopes
 *   PATCH  /api/v1/token/scopes          { scopes: [...] } replace
 *   POST   /api/v1/token/scopes/grant    { scopes: [...] } additive
 */
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = await req.json().catch(() => ({}));
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function dispatch(req: NextRequest, parts: string[], actor: ApiActor) {
  const method = req.method.toUpperCase();
  const [a, b, c] = parts;

  if (method === 'GET' && a === 'me' && !b) {
    return jsonOk(await ApiResources.me(actor));
  }

  // ── Token self-service ──
  if (a === 'token' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.tokenMe(actor));
  }
  if (a === 'token' && b === 'scopes' && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.tokenScopeCatalog(actor));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'replace'));
    }
    if (method === 'POST') {
      // POST /token/scopes also accepted as replace for simple clients
      return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'replace'));
    }
  }
  if (a === 'token' && b === 'scopes' && c === 'grant') {
    if (method === 'POST' || method === 'PATCH') {
      return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'grant'));
    }
  }

  // ── PATs (manage other tokens; needs pats:* ) ──
  if (a === 'pats' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listPats(actor));
    if (method === 'POST') return jsonOk(await ApiResources.createPat(actor, await readBody(req)));
  }
  if (a === 'pats' && b && !c) {
    if (method === 'DELETE') return jsonOk(await ApiResources.revokePat(actor, b));
  }

  // Notes
  if (a === 'notes' && !b) {
    if (method === 'GET') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
      return jsonOk(await ApiResources.listNotes(actor, limit));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createNote(actor, await readBody(req)));
    }
  }
  if (a === 'notes' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getNote(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateNote(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteNote(actor, b));
  }

  // Goals
  if (a === 'goals' && !b) {
    if (method === 'GET') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
      return jsonOk(await ApiResources.listGoals(actor, limit));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createGoal(actor, await readBody(req)));
    }
  }
  if (a === 'goals' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getGoal(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateGoal(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteGoal(actor, b));
  }

  // Flows
  if (method === 'GET' && a === 'flows' && !b) {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listFlows(actor, limit));
  }

  // Workspaces (projects)
  if ((a === 'workspaces' || a === 'projects') && !b) {
    if (method === 'GET') {
      const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
      return jsonOk(await ApiResources.listWorkspaces(actor, limit));
    }
  }
  if ((a === 'workspaces' || a === 'projects') && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getWorkspace(actor, b));
  }

  // Events / forms (list)
  if (a === 'events' && !b && method === 'GET') {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listEvents(actor, limit));
  }
  if (a === 'forms' && !b && method === 'GET') {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listForms(actor, limit));
  }

  // Chats
  if (a === 'chats' && !b && method === 'GET') {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    return jsonOk(await ApiResources.listChats(actor, limit));
  }

  // Agent / harness sessions
  if (a === 'agents' && (b === 'sessions' || !b) && !c && method === 'GET') {
    const limit = Number(req.nextUrl.searchParams.get('limit') || 25);
    const harness = req.nextUrl.searchParams.get('harness');
    return jsonOk(
      await ApiResources.listAgentSessions(actor, limit, {
        harness: harness || null,
      }),
    );
  }
  if (a === 'agents' && b === 'harness' && !c && method === 'POST') {
    return jsonOk(await ApiResources.createHarnessSession(actor, await readBody(req)));
  }
  if (a === 'agents' && b === 'sessions' && c && method === 'POST') {
    // Append mirror entry: POST /agents/sessions/:id/mirror — path may be [agents,sessions,id,mirror]
    // Handled below when parts[3] === 'mirror'
  }
  if (a === 'agents' && b === 'sessions' && c && parts[3] === 'mirror') {
    if (method === 'POST') {
      return jsonOk(await ApiResources.appendHarnessMirror(actor, c, await readBody(req)));
    }
  }

  // Retired dual surface — tools stay in-process only
  if (a === 'tools') {
    const err = new Error(
      'Use REST resource routes (e.g. POST /api/v1/notes). Tool execution is not a public API.',
    );
    (err as any).status = 410;
    (err as any).code = 'gone';
    throw err;
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
