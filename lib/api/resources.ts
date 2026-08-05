import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { listScopeCatalog } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
  cleanRowData,
  filterNoteData,
  getNotePermissions,
} from '@/lib/appwrite/note';
import { createNoteCreationService } from '@/lib/sdk';
import { WorkflowDbService } from '@/lib/services/workflows';

const DB = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTES = APPWRITE_CONFIG.TABLES.NOTE?.NOTES || APPWRITE_CONFIG.TABLES.NOTES;
const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
const WORKFLOWS = 'workflows';

function badRequest(message: string) {
  const err = new Error(message);
  (err as any).status = 400;
  (err as any).code = 'bad_request';
  throw err;
}

function notFound(message: string) {
  const err = new Error(message);
  (err as any).status = 404;
  (err as any).code = 'not_found';
  throw err;
}

function shapeNote(r: any) {
  return {
    id: r.$id,
    title: r.title || r.name || 'Untitled',
    content: r.content ?? r.body ?? null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
    isPublic: !!r.isPublic,
  };
}

function shapeGoal(r: any) {
  return {
    id: r.$id,
    title: r.title || r.name || 'Untitled',
    description: r.description ?? null,
    status: r.status || null,
    updatedAt: r.$updatedAt || r.updatedAt || null,
    createdAt: r.$createdAt || r.createdAt || null,
  };
}

function shapeMoment(r: any) {
  return {
    id: r.$id,
    source: 'ecosystem' as const,
    caption: r.caption || null,
    content: r.caption || null,
    type: r.type || null,
    momentKind: r.momentKind || null,
    sourceId: r.sourceId || null,
    fileId: r.fileId || null,
    userId: r.userId || null,
    createdAt: r.$createdAt || r.createdAt || null,
    isPublic: !!r.isPublic,
  };
}

async function assertOwnedNote(tables: ReturnType<typeof createSystemTablesDB>, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: DB, tableId: NOTES, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Note not found');
  return row;
}

async function assertOwnedGoal(tables: ReturnType<typeof createSystemTablesDB>, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Goal not found');
  return row;
}

/**
 * HTTP API resource CRUD — TablesDB as the actor user via system client.
 * Tools stay internal; routes do not expose tool.execute.
 */
export const ApiResources = {
  async me(actor: ApiActor) {
    requireScope(actor, 'profile:read');
    return {
      id: actor.userId,
      auth: actor.kind,
      scopes: actor.scopes,
      patId: actor.patId || null,
    };
  },

  async listNotes(actor: ApiActor, limit = 25) {
    requireScope(actor, 'notes:read');
    const tables = createSystemTablesDB();
    const { isGhostNote, ideaListExclusionQueries } = await import('@/lib/appwrite/note');
    const res = await tables.listRows({
      databaseId: DB,
      tableId: NOTES,
      queries: [
        Query.equal('userId', actor.userId),
        ...ideaListExclusionQueries(),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.filter((r: any) => !isGhostNote(r)).map(shapeNote);
  },

  async getNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:read');
    const tables = createSystemTablesDB();
    const row = await assertOwnedNote(tables, actor, id);
    return shapeNote(row);
  },

  async createNote(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const title = clampNoteTitle(String(body?.title || '').trim() || 'Untitled', 'Untitled');
    const content = body?.content != null ? String(body.content) : '';
    const isPublic = !!body?.isPublic;
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();

    const service = createNoteCreationService({
      databaseId: DB,
      tableId: NOTES,
      generateId: () => ID.unique(),
      getCurrentUser: async () => ({ $id: actor.userId }),
      createRow: async (databaseId, tableId, data, rowId, permissions) =>
        tables.createRow({
          databaseId,
          tableId,
          rowId: rowId || ID.unique(),
          data: data as any,
          permissions,
        }) as any,
      getNote: async (noteId) =>
        tables.getRow({ databaseId: DB, tableId: NOTES, rowId: noteId }) as any,
      getNotePermissions,
      cleanRowData,
      filterNoteData,
    });

    const note = await service.createNote({
      title,
      content,
      format: 'markdown',
      isPublic,
      tags: Array.isArray(body?.tags) ? (body.tags as string[]).map(String) : undefined,
    });

    // Ensure ownership fields exist even if service omitted them
    if (!(note as any)?.userId) {
      await tables.updateRow({
        databaseId: DB,
        tableId: NOTES,
        rowId: (note as any).$id,
        data: { userId: actor.userId, creatorId: actor.userId, updatedAt: now },
      });
    }

    return shapeNote(note);
  },

  async updateNote(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const tables = createSystemTablesDB();
    await assertOwnedNote(tables, actor, id);

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      patch.title = clampNoteTitle(String(body.title || '').trim() || 'Untitled', 'Untitled');
    }
    if (body.content !== undefined) patch.content = String(body.content);
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;

    const filtered = filterNoteData(cleanRowData(patch));
    const row = await tables.updateRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: id,
      data: filtered as any,
    });
    return shapeNote(row);
  },

  async deleteNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:write');
    const tables = createSystemTablesDB();
    await assertOwnedNote(tables, actor, id);
    await tables.deleteRow({ databaseId: DB, tableId: NOTES, rowId: id });
    return { id, deleted: true };
  },

  async listGoals(actor: ApiActor, limit = 25) {
    requireScope(actor, 'goals:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: TASKS,
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map(shapeGoal);
  },

  async getGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:read');
    const tables = createSystemTablesDB();
    const row = await assertOwnedGoal(tables, actor, id);
    return shapeGoal(row);
  },

  async createGoal(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'goals:write');
    const title = String(body?.title || '').trim();
    if (!title) badRequest('title required');
    const now = new Date().toISOString();
    const tables = createSystemTablesDB();
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body?.description != null ? String(body.description) : '',
        status: String(body?.status || 'todo'),
        userId: actor.userId,
        isPublic: false,
        isGuest: false,
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return shapeGoal(row);
  },

  async updateGoal(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'goals:write');
    const tables = createSystemTablesDB();
    await assertOwnedGoal(tables, actor, id);
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.status !== undefined) patch.status = String(body.status);
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: id,
      data: patch as any,
    });
    return shapeGoal(row);
  },

  async deleteGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:write');
    const tables = createSystemTablesDB();
    await assertOwnedGoal(tables, actor, id);
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id });
    return { id, deleted: true };
  },

  async listFlows(actor: ApiActor, limit = 25) {
    requireScope(actor, 'flows:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: WORKFLOWS,
      queries: [
        Query.equal('ownerId', actor.userId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.workflowId || r.$id,
      name: r.name,
      description: r.description,
      isPublic: !!r.isPublic,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
      installCount: r.installCount ?? 0,
      reviewStatus: r.reviewStatus || null,
      version: r.version ?? 0,
      contentHash: r.contentHash || null,
    }));
  },

  async createFlow(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'flows:write');
    const name = String(body?.name || '').trim();
    if (!name) badRequest('name required');
    const id = String(body?.id || `flow_${Date.now()}`);
    const steps = Array.isArray(body?.steps) ? body.steps : [];
    const wf = {
      id,
      name,
      description: String(body?.description || ''),
      niche: (body?.niche as any) || 'workspace',
      steps,
      isPublic: false,
      isAnonymized: false,
      createdAt: new Date().toISOString(),
    };
    await WorkflowDbService.saveWorkflow(wf, actor.userId);
    return await this.getFlow(actor, id);
  },

  async getFlow(actor: ApiActor, id: string) {
    requireScope(actor, 'flows:read');
    const wf = await WorkflowDbService.getByWorkflowId(id);
    if (!wf) badRequest('Flow not found');
    return wf;
  },

  async publishFlow(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'flows:write');
    const { requestFlowPublishSecure } = await import('@/lib/actions/secure-ops/flows');
    const res = await requestFlowPublishSecure({
      flowId: id,
      confirmAware: body.confirmAware !== false,
      actorId: actor.userId,
    });
    if (res.verdict === 'rejected' || res.verdict === 'blocked') {
      return {
        success: false,
        error: (res as any).error || `Publish rejected due to ${res.verdict} security status`,
        verdict: res.verdict,
        pii: res.pii,
      };
    }
    return res;
  },

  async deleteFlow(actor: ApiActor, id: string) {
    requireScope(actor, 'flows:write');
    const wf = await WorkflowDbService.getByWorkflowId(id);
    if (!wf) badRequest('Flow not found');
    await WorkflowDbService.deleteWorkflow(id);
    return { id, deleted: true };
  },

  // ─── Token self-service (rescue hatch — no extra scope required) ───

  async tokenMe(actor: ApiActor) {
    if (actor.kind !== 'pat' || !actor.patId) {
      return {
        auth: actor.kind,
        userId: actor.userId,
        scopes: actor.scopes,
        patId: null,
        note: 'Session/OAuth tokens have no PAT row; use a kyl_pat_ token for self-service.',
      };
    }
    const pat = await PatService.getOwned({ patId: actor.patId, userId: actor.userId });
    return {
      auth: 'pat',
      userId: actor.userId,
      patId: actor.patId,
      scopes: actor.scopes,
      pat,
      catalog: listScopeCatalog(),
    };
  },

  async tokenScopeCatalog(_actor: ApiActor) {
    return { scopes: listScopeCatalog() };
  },

  /**
   * Self-service scope refresh on the CURRENT bearer PAT.
   * Intentionally does not require pats:write — this is the rescue hatch so a
   * half-baked token can grant itself new scopes as the catalog grows.
   */
  async tokenUpdateScopes(
    actor: ApiActor,
    body: Record<string, unknown>,
    mode: 'replace' | 'grant' = 'replace',
  ) {
    if (actor.kind !== 'pat' || !actor.patId) {
      badRequest('Only personal access tokens can refresh their own scopes');
    }
    const scopes = body.scopes ?? body.grant ?? body.add;
    const pat = await PatService.updateScopes({
      patId: actor.patId!,
      userId: actor.userId,
      scopes,
      mode: body.mode === 'grant' || mode === 'grant' ? 'grant' : 'replace',
    });
    return {
      pat,
      scopes: pat.scopes,
      hint: 'New scopes apply on the next request with this same token (no re-mint).',
    };
  },

  async listPats(actor: ApiActor) {
    requireScope(actor, 'pats:read');
    return PatService.listForUser(actor.userId);
  },

  async createPat(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'pats:write');
    const name = String(body.name || '').trim();
    if (!name) badRequest('name required');
    return PatService.create({
      userId: actor.userId,
      name,
      scopes: body.scopes,
      expiresAt: body.expiresAt != null ? String(body.expiresAt) : null,
    });
  },

  async revokePat(actor: ApiActor, patId: string) {
    requireScope(actor, 'pats:write');
    if (actor.patId && actor.patId === patId) {
      badRequest('Refuse to revoke the token currently authenticating this request');
    }
    return PatService.revoke({ patId, userId: actor.userId });
  },

  async listWorkspaces(actor: ApiActor, limit = 25) {
    requireScope(actor, 'workspaces:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'projects',
      queries: [
        Query.equal('ownerId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      summary: r.summary || r.description || null,
      visibility: r.visibility || null,
      updatedAt: r.$updatedAt || r.updatedAt || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  async getWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:read');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.ownerId !== actor.userId) notFound('Workspace not found');
    return {
      id: row.$id,
      title: row.title || row.name || 'Untitled',
      summary: row.summary || row.description || null,
      visibility: row.visibility || null,
      updatedAt: row.$updatedAt || row.updatedAt || null,
      createdAt: row.$createdAt || row.createdAt || null,
    };
  },

  async listEvents(actor: ApiActor, limit = 25) {
    requireScope(actor, 'events:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'events',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      startsAt: r.startsAt || r.startAt || null,
      endsAt: r.endsAt || r.endAt || null,
      updatedAt: r.$updatedAt || null,
    }));
  },

  async listForms(actor: ApiActor, limit = 25) {
    requireScope(actor, 'forms:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'forms',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      updatedAt: r.$updatedAt || null,
      isPublic: !!r.isPublic,
    }));
  },

  async listAgentSessions(actor: ApiActor, limit = 25, opts?: { harness?: string | null }) {
    requireScope(actor, 'agents:read');
    const tables = createSystemTablesDB();
    const queries: string[] = [
      Query.equal('userId', actor.userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(Math.min(100, Math.max(1, limit))),
    ];
    if (opts?.harness) {
      requireScope(actor, 'agents:harness');
      queries.unshift(Query.equal('harness', String(opts.harness)));
    }
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      queries,
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      harness: r.harness || null,
      isPublic: !!r.isPublic,
      isPinned: !!r.isPinned,
      seen: !!r.seen,
      updatedAt: r.$updatedAt || null,
      createdAt: r.$createdAt || null,
    }));
  },

  async createHarnessSession(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'agents:harness');
    requireScope(actor, 'agents:write');
    const harness = String(body.harness || body.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 64);
    if (!harness) badRequest('harness required (e.g. claude-code, codex)');
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const title = String(body.title || `[${harness}] mirror`).slice(0, 200);
    const seed = {
      role: 'system',
      content: `Harness mirror session for ${harness}. Read-only prompts/tool calls land here.`,
      at: now,
    };
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      rowId: ID.unique(),
      data: {
        userId: actor.userId,
        harness,
        context: title,
        chatHistory: JSON.stringify([seed]),
        seen: false,
        isMemory: false,
        isPublic: false,
        isGuest: false,
        isPinned: false,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return {
      id: (row as any).$id,
      harness,
      context: title,
      mode: 'mirror',
      writable: false,
    };
  },

  async appendHarnessMirror(actor: ApiActor, sessionId: string, body: Record<string, unknown>) {
    requireScope(actor, 'agents:harness');
    requireScope(actor, 'agents:write');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: sessionId })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Session not found');
    if (!row.harness) badRequest('Not a harness session');

    let history: any[] = [];
    try {
      history = JSON.parse(row.chatHistory || '[]');
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
    const entry = {
      role: String(body.role || 'assistant').slice(0, 32),
      content: String(body.content || body.prompt || body.response || '').slice(0, 12000),
      toolCalls: body.toolCalls ?? null,
      at: new Date().toISOString(),
    };
    if (!entry.content && !entry.toolCalls) badRequest('content or toolCalls required');
    history.push(entry);
    // Cap history size in row
    while (history.length > 200) history.shift();

    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      rowId: sessionId,
      data: {
        chatHistory: JSON.stringify(history),
        seen: false,
      },
    });
    return { id: sessionId, appended: true, count: history.length };
  },

  async listChats(actor: ApiActor, limit = 25) {
    requireScope(actor, 'chats:read');
    const tables = createSystemTablesDB();
    const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
    const convTable =
      APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS ||
      APPWRITE_CONFIG.TABLES.CHAT?.CONVERSATIONS ||
      'conversations';
    const res = await tables.listRows({
      databaseId: chatDb,
      tableId: convTable,
      queries: [
        Query.contains('participants', actor.userId),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      type: r.type || null,
      name: r.name || null,
      participantCount: r.participantCount ?? (Array.isArray(r.participants) ? r.participants.length : null),
      lastMessageAt: r.lastMessageAt || null,
      isEncrypted: !!r.isEncrypted,
    }));
  },

  async getChat(actor: ApiActor, id: string) {
    requireScope(actor, 'chats:read');
    const tables = createSystemTablesDB();
    const convTable =
      APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || 'conversations';
    const row = (await tables
      .getRow({ databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: convTable, rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Chat not found');
    const parts = Array.isArray(row.participants) ? row.participants : [];
    if (!parts.includes(actor.userId)) notFound('Chat not found');
    return {
      id: row.$id,
      type: row.type || null,
      name: row.name || null,
      participants: parts,
      lastMessageAt: row.lastMessageAt || null,
      isEncrypted: !!row.isEncrypted,
    };
  },

  async listChatMessages(actor: ApiActor, conversationId: string, limit = 50) {
    requireScope(actor, 'chats:read');
    const chat = await this.getChat(actor, conversationId);
    const tables = createSystemTablesDB();
    const msgTable = APPWRITE_CONFIG.TABLES.CONNECT?.MESSAGES || 'messages';
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: msgTable,
      queries: [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    // E2EE: metadata only. Unencrypted / thread-style: full plaintext.
    return res.rows.map((r: any) => {
      const encrypted = r.isEncrypted !== false && chat.isEncrypted;
      const plaintext = r.content || r.body || null;
      return {
        id: r.$id,
        conversationId: r.conversationId,
        senderId: r.senderId || null,
        createdAt: r.$createdAt || r.createdAt || null,
        isEncrypted: encrypted,
        hasCiphertext: !!(r.content || r.ciphertext || r.body),
        content: encrypted ? null : plaintext,
        contentPreview: encrypted ? null : plaintext,
      };
    });
  },

  async sendChatMessage(actor: ApiActor, conversationId: string, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const chat = await this.getChat(actor, conversationId);
    if (chat.isEncrypted) {
      const err = new Error(
        'Encrypted chats cannot be sent via PAT — unlock vault in the app. Use /threads for unencrypted threads.',
      );
      (err as any).status = 400;
      (err as any).code = 'e2ee_required';
      throw err;
    }
    const content = String(body.content ?? body.text ?? '').trim();
    if (!content) badRequest('content required');
    const tables = createSystemTablesDB();
    const msgTable = APPWRITE_CONFIG.TABLES.CONNECT?.MESSAGES || 'messages';
    const now = new Date().toISOString();
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: msgTable,
      rowId: ID.unique(),
      data: {
        conversationId,
        senderId: actor.userId,
        content,
        isEncrypted: false,
        createdAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return {
      id: (row as any).$id,
      conversationId,
      senderId: actor.userId,
      content,
      isEncrypted: false,
      createdAt: now,
    };
  },

  async createWorkspace(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const now = new Date().toISOString();
    const tables = createSystemTablesDB();
    const visibility = String(body.visibility || 'private');
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        summary: body.summary != null ? String(body.summary) : '',
        ownerId: actor.userId,
        visibility,
        status: 'active',
        isPublic: visibility === 'public',
        isGuest: visibility === 'public',
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return {
      id: (row as any).$id,
      title: (row as any).title,
      summary: (row as any).summary || null,
      visibility: (row as any).visibility || null,
    };
  },

  async updateWorkspace(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, id);
    const tables = createSystemTablesDB();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.summary !== undefined) patch.summary = String(body.summary);
    if (body.visibility !== undefined) {
      patch.visibility = String(body.visibility);
      patch.isPublic = String(body.visibility) === 'public';
    }
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: id,
      data: patch as any,
    });
    return {
      id: (row as any).$id,
      title: (row as any).title,
      summary: (row as any).summary || null,
      visibility: (row as any).visibility || null,
    };
  },

  async deleteWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, id);
    const tables = createSystemTablesDB();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id });
    return { id, deleted: true };
  },

  async attachObjectToWorkspace(actor: ApiActor, workspaceId: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    requireScope(actor, 'objects:write');
    await this.getWorkspace(actor, workspaceId);
    const entityKind = String(body.entityKind || body.kind || '').trim();
    const entityId = String(body.entityId || body.id || '').trim();
    if (!entityKind || !entityId) badRequest('entityKind and entityId required');
    const { addObjectToProjectSecure } = await import('@/lib/actions/secure-ops');
    const res = await addObjectToProjectSecure(workspaceId, entityKind, entityId, body.role as string, body.metadata);
    return {
      id: (res as any)?.$id || ID.unique(),
      workspaceId,
      entityKind,
      entityId,
      attached: true,
    };
  },

  async getEvent(actor: ApiActor, id: string) {
    requireScope(actor, 'events:read');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Event not found');
    return {
      id: row.$id,
      title: row.title || 'Untitled',
      description: row.description || null,
      startTime: row.startTime || null,
      endTime: row.endTime || null,
      location: row.location || null,
      isPublic: !!row.isPublic,
    };
  },

  async createEvent(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const startTime =
      body.startTime != null
        ? String(body.startTime)
        : new Date().toISOString();
    const endTime =
      body.endTime != null
        ? String(body.endTime)
        : new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
    const tables = createSystemTablesDB();

    let calendarId = body.calendarId != null ? String(body.calendarId) : '';
    if (!calendarId) {
      const cals = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'calendars',
        queries: [Query.equal('userId', actor.userId), Query.limit(20)],
      });
      const preferred =
        (cals.rows as any[]).find((c) => c.isDefault) || (cals.rows as any[])[0];
      if (preferred) {
        calendarId = preferred.$id;
      } else {
        const cal = await tables.createRow({
          databaseId: FLOW_DB,
          tableId: 'calendars',
          rowId: ID.unique(),
          data: {
            name: 'Personal',
            color: '#F59E0B',
            isDefault: true,
            userId: actor.userId,
            isPublic: false,
            isGuest: false,
            isPinned: false,
          },
          permissions: [
            Permission.read(Role.user(actor.userId)),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ],
        });
        calendarId = (cal as any).$id;
      }
    }

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'events',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body.description != null ? String(body.description) : '',
        startTime,
        endTime,
        calendarId,
        location: body.location != null ? String(body.location) : null,
        userId: actor.userId,
        status: String(body.status || 'confirmed'),
        visibility: String(body.visibility || 'private'),
        isPublic: !!body.isPublic,
        isGuest: false,
        isPinned: false,
        isDeleted: false,
        isTrash: false,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return this.getEvent(actor, (row as any).$id);
  },

  async updateEvent(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = createSystemTablesDB();
    const patch: Record<string, unknown> = {};
    for (const k of ['title', 'description', 'startTime', 'endTime', 'location', 'status', 'visibility'] as const) {
      if (body[k] !== undefined) patch[k] = body[k] == null ? null : String(body[k]);
    }
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id, data: patch as any });
    return this.getEvent(actor, id);
  },

  async deleteEvent(actor: ApiActor, id: string) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = createSystemTablesDB();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id });
    return { id, deleted: true };
  },

  async getForm(actor: ApiActor, id: string) {
    requireScope(actor, 'forms:read');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Form not found');
    return {
      id: row.$id,
      title: row.title || 'Untitled',
      description: row.description || null,
      schema: row.schema || null,
      status: row.status || null,
      isPublic: !!row.isPublic,
    };
  },

  async createForm(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const tables = createSystemTablesDB();
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'forms',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body.description != null ? String(body.description) : '',
        schema: body.schema != null ? (typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema)) : '[]',
        userId: actor.userId,
        status: String(body.status || 'published'),
        visibility: String(body.visibility || 'private'),
        isPublic: body.isPublic !== undefined ? !!body.isPublic : false,
        isGuest: false,
        isPinned: false,
        isTrash: false,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return this.getForm(actor, (row as any).$id);
  },

  async updateForm(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = createSystemTablesDB();
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.schema !== undefined) {
      patch.schema = typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema);
    }
    if (body.status !== undefined) patch.status = String(body.status);
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id, data: patch as any });
    return this.getForm(actor, id);
  },

  async deleteForm(actor: ApiActor, id: string) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = createSystemTablesDB();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id });
    return { id, deleted: true };
  },

  async installFlow(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'flows:install');
    const flowId = String(body.flowId || body.id || '').trim();
    if (!flowId) badRequest('flowId required');
    const { FlowInstallService } = await import('@/lib/services/flow-installs');
    const result = await FlowInstallService.install({
      flowId,
      installerId: actor.userId,
      scope: (body.scope as any) || { type: 'user' },
      grants: (body.grants as any) || null,
      bindObject: body.bindObject !== false,
    });
    return {
      created: result.created,
      installId: result.install.$id,
      installCount: result.installCount,
      scopeKey: result.install.scopeKey,
    };
  },

  async listFlowInstalls(actor: ApiActor) {
    requireScope(actor, 'flows:read');
    const { FlowInstallService } = await import('@/lib/services/flow-installs');
    const rows = await FlowInstallService.listForInstaller(actor.userId);
    return rows.map((r: any) => ({
      id: r.$id,
      flowId: r.flowId || r.workflowId || null,
      scopeKey: r.scopeKey || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  async listVaultItems(actor: ApiActor, limit = 25) {
    requireScope(actor, 'vault:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      queries: [
        Query.equal('userId', actor.userId),
        Query.equal('isDeleted', false),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    // Metadata only — never return password / card secrets over PAT
    return res.rows.map((r: any) => ({
      id: r.$id,
      name: r.name || 'Untitled',
      itemType: r.itemType || null,
      url: r.url || null,
      username: r.username || null,
      folderId: r.folderId || null,
      isFavorite: !!r.isFavorite,
      updatedAt: r.$updatedAt || r.updatedAt || null,
      hasSecret: !!(r.password || r.cardNumber),
    }));
  },

  async listMoments(actor: ApiActor, limit = 25, opts?: { mine?: boolean }) {
    requireScope(actor, 'moments:read');
    const tables = createSystemTablesDB();
    const momentsTable = APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments';
    const queries: any[] = [
      Query.orderDesc('$createdAt'),
      Query.limit(Math.min(100, Math.max(1, limit))),
    ];
    if (opts?.mine) {
      queries.unshift(Query.equal('userId', actor.userId));
    } else {
      // Public feed posts (exclude reply noise when possible)
      queries.unshift(Query.equal('isPublic', true));
    }
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: momentsTable,
      queries,
    });
    return res.rows
      .filter((r: any) => {
        if (opts?.mine) return true;
        const kind = String(r.momentKind || '').toLowerCase();
        return !kind || kind === 'post' || kind === 'quote' || kind === 'pulse';
      })
      .map((r: any) => shapeMoment(r));
  },

  async listFeed(
    actor: ApiActor,
    limit = 25,
    opts?: { source?: 'ecosystem' | 'nostr' | 'all' },
  ) {
    requireScope(actor, 'moments:read');
    const source = opts?.source || 'all';
    const lim = Math.min(50, Math.max(1, limit));
    const items: any[] = [];

    if (source === 'ecosystem' || source === 'all') {
      const eco = await this.listMoments(actor, lim, { mine: false });
      items.push(...eco.map((m: any) => ({ ...m, feedSource: 'ecosystem' })));
    }

    if (source === 'nostr' || source === 'all') {
      try {
        const { fetchNostrFeed } = await import('@/lib/nostr/server-query');
        const events = await fetchNostrFeed(lim);
        for (const e of events) {
          items.push({
            id: `nostr_${e.id}`,
            source: 'nostr',
            feedSource: 'nostr',
            content: e.content || '',
            caption: e.content || '',
            pubkey: e.pubkey,
            createdAt: new Date(e.created_at * 1000).toISOString(),
            momentKind: 'post',
            isPublic: true,
          });
        }
      } catch (e) {
        console.warn('[ApiResources.listFeed] nostr feed failed', e);
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
    return items.slice(0, lim);
  },

  async getMoment(actor: ApiActor, rawId: string) {
    requireScope(actor, 'moments:read');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);

    if (source === 'nostr') {
      const { fetchNostrEventById, fetchNostrReplies } = await import(
        '@/lib/nostr/server-query'
      );
      const [event, eng] = await Promise.all([
        fetchNostrEventById(id),
        fetchNostrReplies(id),
      ]);
      if (!event) return notFound('Moment not found');
      return {
        id: `nostr_${event.id}`,
        source: 'nostr' as const,
        content: event.content || '',
        caption: event.content || '',
        pubkey: event.pubkey,
        createdAt: new Date(event.created_at * 1000).toISOString(),
        momentKind: 'post',
        isPublic: true,
        stats: {
          likes: eng.likeCount,
          replies: eng.replies.length,
        },
        canCommentViaApi: false,
      };
    }

    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
        rowId: id,
      })
      .catch(() => null)) as any;
    if (!row) notFound('Moment not found');
    // Public moments OR own
    if (!row.isPublic && row.userId !== actor.userId) notFound('Moment not found');
    return { ...shapeMoment(row), canCommentViaApi: true };
  },

  async listMomentComments(actor: ApiActor, rawId: string, limit = 50) {
    requireScope(actor, 'moments:read');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);
    const lim = Math.min(100, Math.max(1, limit));

    if (source === 'nostr') {
      const { fetchNostrReplies } = await import('@/lib/nostr/server-query');
      const eng = await fetchNostrReplies(id);
      return eng.replies.slice(0, lim).map((e) => ({
        id: e.id,
        source: 'nostr' as const,
        content: e.content || '',
        authorPubkey: e.pubkey,
        createdAt: new Date(e.created_at * 1000).toISOString(),
      }));
    }

    await this.getMoment(actor, id);
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      queries: [
        Query.equal('sourceId', id),
        Query.equal('momentKind', 'reply'),
        Query.orderDesc('$createdAt'),
        Query.limit(lim),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      source: 'ecosystem' as const,
      content: r.caption || '',
      userId: r.userId || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  async createMomentComment(actor: ApiActor, rawId: string, body: Record<string, unknown>) {
    requireScope(actor, 'moments:write');
    const { parseMomentRouteId } = await import('@/lib/connect/moment-engagement');
    const { source, id } = parseMomentRouteId(rawId);
    if (source === 'nostr') {
      const err = new Error(
        'Nostr comments need an unlocked vault key — use the app. Internal moments support PAT comments.',
      );
      (err as any).status = 400;
      (err as any).code = 'nostr_vault_required';
      throw err;
    }
    const content = String(body.content ?? body.text ?? body.caption ?? '').trim();
    if (!content) badRequest('content required');
    await this.getMoment(actor, id);

    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ type: 'reply', sourceId: id });
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      rowId: ID.unique(),
      data: {
        userId: actor.userId,
        caption: content,
        type: 'image',
        momentKind: 'reply',
        sourceId: id,
        searchTitle: content.slice(0, 255),
        fileId: metadata,
        isPublic: true,
        isGuest: true,
        createdAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return {
      id: (row as any).$id,
      source: 'ecosystem' as const,
      content,
      userId: actor.userId,
      createdAt: now,
    };
  },

  async createMoment(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'moments:write');
    const content = String(body.content ?? body.caption ?? body.text ?? '').trim();
    if (!content) badRequest('content required');
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ type: 'post' });
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS || 'moments',
      rowId: ID.unique(),
      data: {
        userId: actor.userId,
        caption: content,
        type: 'image',
        momentKind: 'post',
        sourceId: null,
        searchTitle: content.slice(0, 255),
        fileId: metadata,
        isPublic: body.isPublic !== false,
        isGuest: body.isPublic !== false,
        createdAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        ...(body.isPublic !== false ? [Permission.read(Role.any())] : []),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });
    return shapeMoment(row);
  },

  async listThreads(
    actor: ApiActor,
    limit = 25,
    opts?: { parentKind?: string; parentId?: string },
  ) {
    requireScope(actor, 'chats:read');
    const { ThreadService } = await import('@/lib/services/threads');
    if (opts?.parentKind && opts?.parentId) {
      return ThreadService.listForParent(opts.parentKind, opts.parentId, limit);
    }
    return ThreadService.listForOwner(actor.userId, limit);
  },

  async ensureThread(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const parentKind = String(body.parentKind || '').trim();
    const parentId = String(body.parentId || '').trim();
    if (!parentKind || !parentId) badRequest('parentKind and parentId required');
    const { ThreadService } = await import('@/lib/services/threads');
    const result = await ThreadService.getOrCreate({
      parentKind,
      parentId,
      channel: body.channel != null ? String(body.channel) : undefined,
      ownerId: actor.userId,
      title: body.title != null ? String(body.title) : undefined,
      isPublic: body.isPublic === true,
      legacyNoteId: body.legacyNoteId != null ? String(body.legacyNoteId) : null,
    });
    return result;
  },

  async getThread(actor: ApiActor, id: string) {
    requireScope(actor, 'chats:read');
    const { ThreadService } = await import('@/lib/services/threads');
    const thread = await ThreadService.getById(id);
    if (!thread) return notFound('Thread not found');
    if (thread.ownerId !== actor.userId && !thread.isPublic) return notFound('Thread not found');
    return thread;
  },

  async listThreadMessages(
    actor: ApiActor,
    threadId: string,
    limit = 50,
    opts?: { rootMessageId?: string; parentMessageId?: string; topLevelOnly?: boolean },
  ) {
    requireScope(actor, 'chats:read');
    await this.getThread(actor, threadId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.listMessages(threadId, {
      limit,
      rootMessageId: opts?.rootMessageId,
      parentMessageId: opts?.parentMessageId,
      topLevelOnly: opts?.topLevelOnly,
      includeLegacyComments: true,
    });
  },

  async createThreadMessage(actor: ApiActor, threadId: string, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    await this.getThread(actor, threadId);
    const text = String(body.content ?? body.text ?? '').trim();
    if (!text) badRequest('content required');
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.postMessage({
      threadId,
      userId: actor.userId,
      content: text,
      parentMessageId:
        body.parentMessageId != null
          ? String(body.parentMessageId)
          : body.parentCommentId != null
            ? String(body.parentCommentId)
            : null,
      contentType: body.contentType != null ? String(body.contentType) : 'text',
      metadata: body.metadata != null ? String(body.metadata) : null,
      isVoice: body.isVoice === true,
      isEncrypted: body.isEncrypted === true,
    });
  },

  async getWorkspaceThread(actor: ApiActor, workspaceId: string) {
    requireScope(actor, 'chats:read');
    requireScope(actor, 'workspaces:read');
    const tables = createSystemTablesDB();
    const project = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: workspaceId })
      .catch(() => null)) as any;
    if (!project) notFound('Workspace not found');

    const { ThreadService } = await import('@/lib/services/threads');
    let legacyNoteId: string | null = null;
    try {
      const meta = JSON.parse(project.metadata || '{}');
      legacyNoteId = meta.discussionNoteId || null;
    } catch {
      legacyNoteId = null;
    }

    const { thread, created } = await ThreadService.getOrCreate({
      parentKind: 'workspace',
      parentId: workspaceId,
      channel: ThreadService.CHANNEL_GENERAL,
      ownerId: project.ownerId || actor.userId,
      title: `${project.title || 'Workspace'} discussion`,
      legacyNoteId: project.primaryThreadId ? null : legacyNoteId,
    });

    // Prefer stamped primaryThreadId; adopt legacy if present
    if (legacyNoteId && !thread.legacyNoteId) {
      await ThreadService.adoptLegacyNote({
        parentKind: 'workspace',
        parentId: workspaceId,
        ownerId: project.ownerId || actor.userId,
        legacyNoteId,
        title: `${project.title || 'Workspace'} discussion`,
      });
    }

    const fresh = (await ThreadService.getById(thread.id)) || thread;
    if (fresh.ownerId !== actor.userId && project.ownerId !== actor.userId && !fresh.isPublic) {
      notFound('Thread not found');
    }
    const messages = await ThreadService.listMessages(fresh.id, {
      limit: 100,
      includeLegacyComments: true,
    });
    return {
      workspaceId,
      threadId: fresh.id,
      thread: fresh,
      messages,
      created,
    };
  },

  async replyWorkspaceThread(
    actor: ApiActor,
    workspaceId: string,
    body: Record<string, unknown>,
  ) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'workspaces:read');
    const pack = await this.getWorkspaceThread(actor, workspaceId);
    if (!pack.threadId) badRequest('Workspace has no discussion thread');
    return this.createThreadMessage(actor, pack.threadId, body);
  },

  async ensureNoteDiscussion(actor: ApiActor, noteId: string) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'notes:read');
    await assertOwnedNote(createSystemTablesDB(), actor, noteId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.getOrCreate({
      parentKind: 'note',
      parentId: noteId,
      channel: ThreadService.CHANNEL_DISCUSS,
      ownerId: actor.userId,
      title: 'Discussion',
    });
  },

  async ensureGoalDiscussion(actor: ApiActor, goalId: string) {
    requireScope(actor, 'chats:write');
    requireScope(actor, 'goals:read');
    await assertOwnedGoal(createSystemTablesDB(), actor, goalId);
    const { ThreadService } = await import('@/lib/services/threads');
    return ThreadService.getOrCreate({
      parentKind: 'goal',
      parentId: goalId,
      channel: ThreadService.CHANNEL_DISCUSS,
      ownerId: actor.userId,
      title: 'Goal discussion',
    });
  },

  async listTags(actor: ApiActor, limit = 50) {
    requireScope(actor, 'tags:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.TAGS || APPWRITE_CONFIG.TABLES.NOTE.TAGS,
      queries: [
        Query.equal('userId', actor.userId),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      name: r.name || r.label || r.$id,
      color: r.color || null,
    }));
  },

  async listObjects(actor: ApiActor, limit = 50) {
    requireScope(actor, 'objects:read');
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => ({
      id: r.$id,
      parentKind: r.parentKind || null,
      parentId: r.parentId || null,
      childKind: r.childKind || null,
      childId: r.childId || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));
  },

  async getAgentSession(actor: ApiActor, id: string) {
    requireScope(actor, 'agents:read');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Session not found');
    if (row.harness) requireScope(actor, 'agents:harness');
    let history: unknown[] = [];
    try {
      history = JSON.parse(row.chatHistory || '[]');
    } catch {
      history = [];
    }
    return {
      id: row.$id,
      harness: row.harness || null,
      context: row.context || null,
      isPublic: !!row.isPublic,
      isPinned: !!row.isPinned,
      history,
      updatedAt: row.$updatedAt || null,
    };
  },

  async deleteAgentSession(actor: ApiActor, id: string) {
    requireScope(actor, 'agents:write');
    await this.getAgentSession(actor, id);
    const tables = createSystemTablesDB();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id });
    return { id, deleted: true };
  },
};
