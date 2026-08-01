import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
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
};
