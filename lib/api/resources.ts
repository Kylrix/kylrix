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
    const res = await tables.listRows({
      databaseId: DB,
      tableId: NOTES,
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map(shapeNote);
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
      isPublic: !!r.isPublic,
      installCount: r.installCount ?? 0,
      reviewStatus: r.reviewStatus || null,
    }));
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
};
