import { NextRequest } from 'next/server';
import { withApiGuard, jsonOk, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';
import { API_V1_SEGMENTS as S, API_V1_SUBSEGMENTS as SUB, isWorkspaceSegment, workspaceIdParam } from '@/sdk/api/routes';

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
  const mekHeader = req.headers.get('x-kylrix-mek') || req.headers.get('X-Kylrix-MEK') || req.nextUrl.searchParams.get('mek');

  if (method === 'GET' && a === S.me && !b) {
    return jsonOk(await ApiResources.me(actor));
  }

  // Token self-service
  if (a === S.token && !b && method === 'GET') return jsonOk(await ApiResources.tokenMe(actor));
  if (a === S.token && b === SUB.scopes && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.tokenScopeCatalog(actor));
    if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
      return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'replace'));
    }
  }
  if (a === S.token && b === SUB.scopes && c === SUB.grant && (method === 'POST' || method === 'PATCH')) {
    return jsonOk(await ApiResources.tokenUpdateScopes(actor, await readBody(req), 'grant'));
  }

  // PATs
  if (a === S.pats && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listPats(actor));
    if (method === 'POST') return jsonOk(await ApiResources.createPat(actor, await readBody(req)));
  }
  if (a === S.pats && b && !c && method === 'DELETE') {
    return jsonOk(await ApiResources.revokePat(actor, b));
  }

  // Notes
  if (a === S.notes && !b) {
    if (method === 'GET') {
      const workspaceId = workspaceIdParam(req.nextUrl.searchParams);
      return jsonOk(await ApiResources.listNotes(actor, limit(), { workspaceId: workspaceId || null }));
    }
    if (method === 'POST') return jsonOk(await ApiResources.createNote(actor, await readBody(req)));
  }
  if (a === S.notes && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getNote(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateNote(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteNote(actor, b));
  }

  // Goals
  if (a === S.goals && !b) {
    if (method === 'GET') {
      const workspaceId = workspaceIdParam(req.nextUrl.searchParams);
      const status = req.nextUrl.searchParams.get('status');
      return jsonOk(
        await ApiResources.listGoals(actor, limit(), {
          workspaceId: workspaceId || null,
          status: status || null,
        }),
      );
    }
    if (method === 'POST') return jsonOk(await ApiResources.createGoal(actor, await readBody(req)));
  }
  if (a === S.goals && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getGoal(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateGoal(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteGoal(actor, b));
  }

  // Flows
  if (a === S.flows && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listFlows(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createFlow(actor, await readBody(req)));
  }
  if (a === S.flows && b && !c && b !== SUB.installs && b !== SUB.install) {
    if (method === 'GET') return jsonOk(await ApiResources.getFlow(actor, b));
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteFlow(actor, b));
  }
  if (a === S.flows && b && c === SUB.publish && method === 'POST') {
    return jsonOk(await ApiResources.publishFlow(actor, b, await readBody(req)));
  }
  if (a === S.flows && b === SUB.installs && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.listFlowInstalls(actor));
    if (method === 'POST') return jsonOk(await ApiResources.installFlow(actor, await readBody(req)));
  }
  if (a === S.flows && b === SUB.install && !c && method === 'POST') {
    return jsonOk(await ApiResources.installFlow(actor, await readBody(req)));
  }

  // Workspaces
  if (isWorkspaceSegment(a) && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listWorkspaces(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createWorkspace(actor, await readBody(req)));
  }
  if (isWorkspaceSegment(a) && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getWorkspace(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateWorkspace(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteWorkspace(actor, b));
  }
  if (isWorkspaceSegment(a) && b && (c === SUB.objects || c === SUB.attach) && !d && method === 'POST') {
    return jsonOk(await ApiResources.attachObjectToWorkspace(actor, b, await readBody(req)));
  }
  if (isWorkspaceSegment(a) && b && (c === SUB.collaborators || c === SUB.members) && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.listWorkspaceCollaborators(actor, b));
    if (method === 'POST') return jsonOk(await ApiResources.addWorkspaceCollaborator(actor, b, await readBody(req)));
  }

  // Events
  if (a === S.events && !b) {
    if (method === 'GET') {
      const workspaceId = workspaceIdParam(req.nextUrl.searchParams);
      return jsonOk(await ApiResources.listEvents(actor, limit(), { workspaceId: workspaceId || null }));
    }
    if (method === 'POST') return jsonOk(await ApiResources.createEvent(actor, await readBody(req)));
  }
  if (a === S.events && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getEvent(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateEvent(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteEvent(actor, b));
  }

  // Forms
  if (a === S.forms && !b) {
    if (method === 'GET') {
      const workspaceId = workspaceIdParam(req.nextUrl.searchParams);
      return jsonOk(await ApiResources.listForms(actor, limit(), { workspaceId: workspaceId || null }));
    }
    if (method === 'POST') return jsonOk(await ApiResources.createForm(actor, await readBody(req)));
  }
  if (a === S.forms && b && !c) {
    if (method === 'GET') return jsonOk(await ApiResources.getForm(actor, b));
    if (method === 'PATCH' || method === 'PUT') {
      return jsonOk(await ApiResources.updateForm(actor, b, await readBody(req)));
    }
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteForm(actor, b));
  }

  // Chats (E2EE metadata; plaintext send only when unencrypted; start direct chat)
  if (a === S.chats && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listChats(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createChat(actor, await readBody(req)));
  }
  if (a === S.chats && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getChat(actor, b));
  }
  if (a === S.chats && b && c === SUB.messages && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.listChatMessages(actor, b, limit()));
    if (method === 'POST') {
      return jsonOk(await ApiResources.sendChatMessage(actor, b, await readBody(req)));
    }
  }

  // Threads (canonical threads + thread_messages tables)
  if (a === S.threads && !b) {
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
  if (a === S.threads && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getThread(actor, b));
  }
  if (a === S.threads && b && c === SUB.messages && !d) {
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
  if (a === S.notes && b && c === SUB.discussion && !d && method === 'POST') {
    return jsonOk(await ApiResources.ensureNoteDiscussion(actor, b));
  }
  if (a === S.goals && b && c === SUB.discussion && !d && method === 'POST') {
    return jsonOk(await ApiResources.ensureGoalDiscussion(actor, b));
  }

  // Agents
  if (a === S.agents && b === SUB.keys && !c && method === 'POST') {
    return jsonOk(await ApiResources.createAgentKey(actor, await readBody(req)));
  }
  if (a === S.agents && b === SUB.provision && !c && method === 'POST') {
    return jsonOk(await ApiResources.provisionAgent(actor, await readBody(req)));
  }
  if (a === S.agents && b && c === SUB.identity && !d && method === 'POST') {
    return jsonOk(await ApiResources.initAgentIdentity(actor, b, await readBody(req)));
  }
  if (a === S.agents && (!b || b === SUB.sessions) && !c && method === 'GET') {
    const harness = req.nextUrl.searchParams.get('harness');
    const workspaceId = workspaceIdParam(req.nextUrl.searchParams);
    return jsonOk(
      await ApiResources.listAgentSessions(actor, limit(), {
        harness: harness || null,
        workspaceId: workspaceId || null,
      }),
    );
  }
  if (a === S.agents && b === SUB.sessions && c && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.getAgentSession(actor, c));
    if (method === 'DELETE') return jsonOk(await ApiResources.deleteAgentSession(actor, c));
  }
  if (a === S.agents && b === SUB.harness && !c && method === 'POST') {
    return jsonOk(await ApiResources.createHarnessSession(actor, await readBody(req)));
  }
  if (a === S.agents && b === SUB.sessions && c && d === SUB.mirror && method === 'POST') {
    return jsonOk(await ApiResources.appendHarnessMirror(actor, c, await readBody(req)));
  }

  // Vault
  if (a === S.vault && (!b || b === SUB.items) && !c) {
    const wsId = workspaceIdParam(req.nextUrl.searchParams) || undefined;
    const agId = req.nextUrl.searchParams.get('agentId') || undefined;
    if (method === 'GET') {
      return jsonOk(await ApiResources.listVaultItems(actor, limit(), { mek: mekHeader, workspaceId: wsId, agentId: agId }));
    }
    if (method === 'POST') {
      const body = await readBody(req);
      return jsonOk(
        await ApiResources.createVaultItem(actor, body, {
          mek: mekHeader || (body.mek as string),
          workspaceId: wsId || (body.workspaceId as string) || (body.projectId as string),
          agentId: agId || (body.agentId as string),
        }),
      );
    }
  }
  if (a === S.vault && b && b !== SUB.items && !c) {
    const wsId = workspaceIdParam(req.nextUrl.searchParams) || undefined;
    const agId = req.nextUrl.searchParams.get('agentId') || undefined;
    if (method === 'GET') {
      return jsonOk(await ApiResources.getVaultItem(actor, b, { mek: mekHeader, workspaceId: wsId, agentId: agId }));
    }
    if (method === 'PATCH' || method === 'PUT') {
      const body = await readBody(req);
      return jsonOk(
        await ApiResources.updateVaultItem(actor, b, body, {
          mek: mekHeader || (body.mek as string),
          workspaceId: wsId || (body.workspaceId as string) || (body.projectId as string),
          agentId: agId || (body.agentId as string),
        }),
      );
    }
    if (method === 'DELETE') {
      return jsonOk(await ApiResources.deleteVaultItem(actor, b));
    }
  }

  // Vault - TOTP Secrets
  if ((a === S.totp && (!b || b === SUB.items) && !c) || (a === S.vault && b === S.totp && !c)) {
    const wsId = workspaceIdParam(req.nextUrl.searchParams) || undefined;
    const agId = req.nextUrl.searchParams.get('agentId') || undefined;
    if (method === 'GET') {
      return jsonOk(await ApiResources.listTotpSecrets(actor, limit(), { mek: mekHeader, workspaceId: wsId, agentId: agId }));
    }
    if (method === 'POST') {
      const body = await readBody(req);
      return jsonOk(
        await ApiResources.createTotpSecret(actor, body, {
          mek: mekHeader || (body.mek as string),
          workspaceId: wsId || (body.workspaceId as string) || (body.projectId as string),
          agentId: agId || (body.agentId as string),
        }),
      );
    }
  }
  if ((a === S.totp && b && b !== SUB.items && !c) || (a === S.vault && b === S.totp && c)) {
    const targetId = a === S.totp ? b : c;
    const wsId = workspaceIdParam(req.nextUrl.searchParams) || undefined;
    const agId = req.nextUrl.searchParams.get('agentId') || undefined;
    if (method === 'GET') {
      return jsonOk(await ApiResources.getTotpSecret(actor, targetId, { mek: mekHeader, workspaceId: wsId, agentId: agId }));
    }
    if (method === 'PATCH' || method === 'PUT') {
      const body = await readBody(req);
      return jsonOk(
        await ApiResources.updateTotpSecret(actor, targetId, body, {
          mek: mekHeader || (body.mek as string),
          workspaceId: wsId || (body.workspaceId as string) || (body.projectId as string),
          agentId: agId || (body.agentId as string),
        }),
      );
    }
    if (method === 'DELETE') {
      return jsonOk(await ApiResources.deleteTotpSecret(actor, targetId));
    }
  }

  // Trash / Recovery System
  if (a === S.trash && !b) {
    if (method === 'GET') {
      const kind = req.nextUrl.searchParams.get('kind') || undefined;
      return jsonOk(await ApiResources.listTrash(actor, limit(), { kind }));
    }
    if (method === 'POST') {
      const body = await readBody(req);
      if (body.action === 'restore' || body.restore) {
        return jsonOk(await ApiResources.restoreTrash(actor, body));
      }
      if (body.action === 'purge' || body.purge) {
        return jsonOk(await ApiResources.purgeTrash(actor, body));
      }
      return jsonOk(await ApiResources.restoreTrash(actor, body));
    }
  }
  if (a === S.trash && b === SUB.restore && !c && method === 'POST') {
    return jsonOk(await ApiResources.restoreTrash(actor, await readBody(req)));
  }
  if (a === S.trash && b === SUB.purge && !c && method === 'POST') {
    return jsonOk(await ApiResources.purgeTrash(actor, await readBody(req)));
  }
  if (a === S.trash && b && c && !d && method === 'DELETE') {
    return jsonOk(await ApiResources.purgeTrash(actor, { kind: b, id: c }));
  }

  // Feeds
  if (a === S.feeds && !b && method === 'GET') {
    const source = (req.nextUrl.searchParams.get('source') || 'all') as
      | 'ecosystem'
      | 'nostr'
      | 'all';
    return jsonOk(await ApiResources.listFeed(actor, limit(), { source }));
  }

  // Moments (internal + nostr view; comments on internal)
  if (a === S.moments && !b) {
    if (method === 'GET') {
      const mine = req.nextUrl.searchParams.get('mine') === '1';
      return jsonOk(await ApiResources.listMoments(actor, limit(), { mine }));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createMoment(actor, await readBody(req)));
    }
  }
  if (a === S.moments && b && !c && method === 'GET') {
    return jsonOk(await ApiResources.getMoment(actor, b));
  }
  if (a === S.moments && b && c === SUB.comments && !d) {
    if (method === 'GET') {
      return jsonOk(await ApiResources.listMomentComments(actor, b, limit()));
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.createMomentComment(actor, b, await readBody(req)));
    }
  }

  // Workspace discussion thread shortcut
  if (isWorkspaceSegment(a) && b && c === 'thread' && !d) {
    if (method === 'GET') return jsonOk(await ApiResources.getWorkspaceThread(actor, b));
    if (method === 'POST') {
      return jsonOk(await ApiResources.replyWorkspaceThread(actor, b, await readBody(req)));
    }
  }
  if (isWorkspaceSegment(a) && b && c === 'thread' && d === SUB.messages) {
    if (method === 'GET') {
      const pack = await ApiResources.getWorkspaceThread(actor, b);
      return jsonOk((pack as any).messages || []);
    }
    if (method === 'POST') {
      return jsonOk(await ApiResources.replyWorkspaceThread(actor, b, await readBody(req)));
    }
  }

  if (a === S.tags && !b) {
    if (method === 'GET') return jsonOk(await ApiResources.listTags(actor, limit()));
    if (method === 'POST') return jsonOk(await ApiResources.createTag(actor, await readBody(req)));
  }
  if (a === S.tags && b && !c && method === 'DELETE') {
    return jsonOk(await ApiResources.deleteTag(actor, b));
  }
  if (a === S.objects && !b && method === 'GET') {
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
