import { NextRequest } from 'next/server';
import { withApiGuard, jsonOk, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = await req.json().catch(() => ({}));
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function dispatch(req: NextRequest, parts: string[], actor: ApiActor) {
  const method = req.method.toUpperCase();
  const [a, b, c, d] = parts;
  const limit = () => Number(req.nextUrl.searchParams.get('limit') || 25);

  if (method === 'GET' && a === 'me' && !b) {
    return jsonOk(await ApiResources.me(actor));
  }

  // Token self-service
  if (a === 'token' && !b && method === 'GET') return jsonOk(await ApiResources.tokenMe(actor));
  if (a === 'token' && b === 'scopes' && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.tokenScopeCatalog(actor));
    if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
      return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'replace'));
    }
  }
  if (a === 'token' && b === 'scopes' && c === 'grant' && (method === 'POST' || method === 'PATCH')) {
    return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'grant'));
  }

  // PATs
  if (a === 'pats' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listPats(actor));
    if (method === 'POST') return jsonOk(await ApiResources.createPat(actor, await readBody(req)));
  }
  if (a === 'pats' && b && !c && method === 'DELETE') {
    return jsonOk(await ApiResources.revokePat(actor, b));
  }

  // Notes
  if (a === 'notes' && !b) {
    if (method === 'GET') {
      const workspaceId = req.nextUrl.searchParams.get('workspaceId') || req.nextUrl.searchParams.get('projectId');
      return jsonOk(await ApiResources.listNotes(actor, limit(), { workspaceId: workspaceId || null }));
    }
    if (method === 'POST') return jsonOk(await ApiResources.createNote(actor, await readBody(req)));
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
    if (method === 'GET') return jsonOk(await ApiResources.listGoals(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createGoal(actor, await readBody(req)));
  }
  if (a === 'goals' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getGoal(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateGoal(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteGoal(actor, b));
  }

  // Flows
  if (a === 'flows' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listFlows(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createFlow(actor, await readBody(req)));
  }
  if (a === 'flows' && b && !c && b !== 'installs' && b !== 'install') {
    if (method === 'GET') return jsonOk(await ApiResources.getFlow(actor, b));
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteFlow(actor, b));
  }
  if (a === 'flows' && b && c === 'publish' && method === 'POST') {
    return jsonOk(await ApiResources.publishFlow(actor, b, await readBody(req)));
  }
  if (a === 'flows' && b === 'installs' && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.listFlowInstalls(actor));
    if (method === 'POST') return jsonOk(await ApiResources.installFlow(actor, await readBody(req)));
  }
  if (a === 'flows' && b === 'install' && !c && method === 'POST') {
    return jsonOk(await ApiResources.installFlow(actor, await readBody(req)));
  }

  // Workspaces
  if ((a === 'workspaces' || a === 'projects') && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listWorkspaces(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createWorkspace(actor, await readBody(req)));
  }
  if ((a === 'workspaces' || a === 'projects') && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getWorkspace(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateWorkspace(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteWorkspace(actor, b));
  }
  if ((a === 'workspaces' || a === 'projects') && b && (c === 'objects' || c === 'attach') && !d && method === 'POST') {
    return jsonOk(await ApiResources.attachObjectToWorkspace(actor, b, await readBody(req)));
  }

  // Events
  if (a === 'events' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listEvents(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createEvent(actor, await readBody(req)));
  }
  if (a === 'events' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getEvent(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateEvent(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteEvent(actor, b));
  }

  // Forms
  if (a === 'forms' && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listForms(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createForm(actor, await readBody(req)));
  }
  if (a === 'forms' && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getForm(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateForm(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteForm(actor, b));
  }

  // Chats (E2EE metadata; plaintext send only when unencrypted)
  if (a === 'chats' && !b && method === 'GET') {
    return jsonOk(await ApiResources.listChats(actor, limit()));
  }
  if (a === 'chats' && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getChat(actor, b));
  }
  if (a === 'chats' && b && c === 'messages' && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.listChatMessages(actor, b, limit()));
    if (method === 'POST') {
      return jsonOk(await ApiResources.sendChatMessage(actor, b, await readBody(req)));
    }
  }

  // Threads (canonical threads + thread_messages tables)
  if (a === 'threads' && !b) {
    if (method === 'GET') {
      const parentKind = req.nextUrl.searchParams.get('parentKind') || undefined;
      const parentId = req.nextUrl.searchParams.get('parentId') || undefined;
      return jsonOk(
        await ApiResources.listThreads(actor, limit(), { parentKind, parentId }),
      );
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.ensureThread(actor, await readBody(req)));
    }
  }
  if (a === 'threads' && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getThread(actor, b));
  }
  if (a === 'threads' && b && c === 'messages' && !d) {
    if (method === 'GET') {
      return jsonOk(
        await ApiResources.listThreadMessages(actor, b, limit(), {
          rootMessageId: req.nextUrl.searchParams.get('rootMessageId') || undefined,
          parentMessageId: req.nextUrl.searchParams.get('parentMessageId') || undefined,
          topLevelOnly: req.nextUrl.searchParams.get('topLevel') === '1',
        }),
      );
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createThreadMessage(actor, b, await readBody(req)));
    }
  }

  // Idea / goal discussion ensure shortcuts
  if (a === 'notes' && b && c === 'discussion' && !d && method === 'POST') {
    return jsonOk(await ApiResources.ensureNoteDiscussion(actor, b));
  }
  if (a === 'goals' && b && c === 'discussion' && !d && method === 'POST') {
    return jsonOk(await ApiResources.ensureGoalDiscussion(actor, b));
  }

  // Agents
  if (a === 'agents' && b === 'keys' && !c && method === 'POST') {
    return jsonOk(await ApiResources.createAgentKey(actor, await readBody(req)));
  }
  if (a === 'agents' && b === 'provision' && !c && method === 'POST') {
    return jsonOk(await ApiResources.provisionAgent(actor, await readBody(req)));
  }
  if (a === 'agents' && (!b || b === 'sessions') && !c && method === 'GET') {
    const harness = req.nextUrl.searchParams.get('harness');
    return jsonOk(
      await ApiResources.listAgentSessions(actor, limit(), { harness: harness || null }),
    );
  }
  if (a === 'agents' && b === 'sessions' && c && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.getAgentSession(actor, c));
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteAgentSession(actor, c));
  }
  if (a === 'agents' && b === 'harness' && !c && method === 'POST') {
    return jsonOk(await ApiResources.createHarnessSession(actor, await readBody(req)));
  }
  if (a === 'agents' && b === 'sessions' && c && d === 'mirror' && method === 'POST') {
    return jsonOk(await ApiResources.appendHarnessMirror(actor, c, await readBody(req)));
  }

  // Vault metadata
  if (a === 'vault' && (!b || b === 'items') && !c && method === 'GET') {
    return jsonOk(await ApiResources.listVaultItems(actor, limit()));
  }

  // Feeds
  if (a === 'feeds' && !b && method === 'GET') {
    const source = (req.nextUrl.searchParams.get('source') || 'all') as
      | 'ecosystem'
      | 'nostr'
      | 'all';
    return jsonOk(await ApiResources.listFeed(actor, limit(), { source }));
  }

  // Moments (internal + nostr view; comments on internal)
  if (a === 'moments' && !b) {
    if (method === 'GET') {
      const mine = req.nextUrl.searchParams.get('mine') === '1';
      return jsonOk(await ApiResources.listMoments(actor, limit(), { mine }));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createMoment(actor, await readBody(req)));
    }
  }
  if (a === 'moments' && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getMoment(actor, b));
  }
  if (a === 'moments' && b && c === 'comments' && !d) {
    if (method === 'GET') {
      return jsonOk(await ApiResources.listMomentComments(actor, b, limit()));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createMomentComment(actor, b, await readBody(req)));
    }
  }

  // Workspace discussion thread shortcut
  if ((a === 'workspaces' || a === 'projects') && b && c === 'thread' && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.getWorkspaceThread(actor, b));
    if (method === 'POST') {
      return jsonOk(await ApiResources.replyWorkspaceThread(actor, b, await readBody(req)));
    }
  }
  if ((a === 'workspaces' || a === 'projects') && b && c === 'thread' && d === 'messages') {
    if (method === 'GET') {
      const pack = await ApiResources.getWorkspaceThread(actor, b);
      return jsonOk((pack as any).messages || []);
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.replyWorkspaceThread(actor, b, await readBody(req)));
    }
  }

  if (a === 'tags' && !b && method === 'GET') {
    return jsonOk(await ApiResources.listTags(actor, limit()));
  }
  if (a === 'objects' && !b && method === 'GET') {
    return jsonOk(await ApiResources.listObjects(actor, limit()));
  }

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
