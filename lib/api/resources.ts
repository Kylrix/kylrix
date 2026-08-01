import { Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { toolRegistry } from '@/lib/tools/registry';

const DB = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTES = APPWRITE_CONFIG.TABLES.NOTE?.NOTES || APPWRITE_CONFIG.TABLES.NOTES;
const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
const WORKFLOWS = 'workflows';

/**
 * Shared resource accessors — used by HTTP API and (later) server actions.
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
    return res.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      updatedAt: r.$updatedAt || r.updatedAt,
      isPublic: !!r.isPublic,
    }));
  },

  async getNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:read');
    const tables = createSystemTablesDB();
    const row = await tables.getRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: id,
    }).catch(() => null) as any;
    if (!row || row.userId !== actor.userId) {
      const err = new Error('Note not found');
      (err as any).status = 404;
      throw err;
    }
    return {
      id: row.$id,
      title: row.title || row.name || 'Untitled',
      content: row.content ?? row.body ?? null,
      updatedAt: row.$updatedAt || row.updatedAt,
      isPublic: !!row.isPublic,
    };
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
    return res.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      status: r.status || null,
      updatedAt: r.$updatedAt || r.updatedAt,
    }));
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

  async executeTool(
    actor: ApiActor,
    toolId: string,
    params: Record<string, unknown>
  ) {
    requireScope(actor, 'tools:execute');
    return toolRegistry.executeTool(toolId, params || {}, {
      userId: actor.userId,
      via: 'api',
      patId: actor.patId,
    });
  },
};
