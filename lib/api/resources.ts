import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { listScopeCatalog, type PatScope } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
  cleanRowData,
  filterNoteData,
  getNotePermissions,
} from '@/lib/appwrite/note';
import { createNoteCreationService } from '@/lib/sdk';
import { WorkflowDbService } from '@/lib/services/workflows';
import {
  generateRandomVaultSecret,
  parseMekToBytes,
  sealVaultSecret,
  unsealVaultSecret,
  sealRowFields,
  unsealRowFields,
  looksEncrypted,
  VAULT_ENCRYPTED_FIELDS,
} from '@/lib/api/vault-crypto';

const DB = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTES = APPWRITE_CONFIG.TABLES.NOTE?.NOTES || APPWRITE_CONFIG.TABLES.NOTES;
const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
const WORKFLOWS = 'workflows';

function badRequest(message: string): never {
  const err = new Error(message);
  (err as any).status = 400;
  (err as any).code = 'bad_request';
  throw err;
}

function notFound(message: string): never {
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
    isPublic: r.isPublic !== undefined ? Boolean(r.isPublic) : true,
    isGuest: r.isGuest !== undefined ? Boolean(r.isGuest) : true,
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
    isPublic: r.isPublic !== undefined ? Boolean(r.isPublic) : true,
    isGuest: r.isGuest !== undefined ? Boolean(r.isGuest) : true,
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

const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECT_OBJECTS = 'project_objects';

async function linkObjectToWorkspace(
  tables: ReturnType<typeof createSystemTablesDB>,
  projectId: string,
  entityKind: 'note' | 'goal' | 'form' | 'event' | 'credential' | 'totp' | 'agent_session' | 'secret',
  entityId: string,
  userId: string,
  metadata?: any
) {
  const now = new Date().toISOString();
  try {
    const existing = await tables.listRows({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', entityKind),
        Query.equal('entityId', entityId),
        Query.limit(1),
      ],
    }).catch(() => ({ rows: [] as any[] }));
    if (existing.rows && existing.rows.length > 0) return existing.rows[0];

    return await tables.createRow({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      rowId: ID.unique(),
      data: {
        projectId,
        entityKind,
        entityId,
        role: 'member',
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        createdAt: now,
        updatedAt: now,
      },
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(userId))],
    });
  } catch (err) {
    console.warn(`[ApiResources] Failed to link ${entityKind} ${entityId} to workspace ${projectId}:`, err);
    return null;
  }
}

async function unlinkObjectFromWorkspace(
  tables: ReturnType<typeof createSystemTablesDB>,
  entityKind: string,
  entityId: string
) {
  try {
    const res = await tables.listRows({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      queries: [
        Query.equal('entityKind', entityKind),
        Query.equal('entityId', entityId),
        Query.limit(25),
      ],
    }).catch(() => ({ rows: [] as any[] }));
    for (const r of res.rows || []) {
      await tables.deleteRow({
        databaseId: CHAT_DB,
        tableId: PROJECT_OBJECTS,
        rowId: (r as any).$id,
      }).catch(() => null);
    }
  } catch (err) {
    console.warn(`[ApiResources] Failed to unlink ${entityKind} ${entityId}:`, err);
  }
}

const TAGS_TABLE = APPWRITE_CONFIG.TABLES.TAGS || APPWRITE_CONFIG.TABLES.NOTE.TAGS || '67ff06280034908cf08a';

async function ensureTagsExist(
  tables: ReturnType<typeof createSystemTablesDB>,
  userId: string,
  rawTags: unknown[],
): Promise<string[]> {
  if (!Array.isArray(rawTags)) return [];
  const cleanTags = Array.from(
    new Set(
      rawTags
        .map((t) => String(t || '').trim())
        .filter((t) => t.length > 0 && !t.startsWith('workspace:') && !t.startsWith('project:')),
    ),
  );
  if (!cleanTags.length) return [];

  const now = new Date().toISOString();
  for (const name of cleanTags) {
    const nameLower = name.toLowerCase();
    try {
      const existing = await tables
        .listRows({
          databaseId: DB,
          tableId: TAGS_TABLE,
          queries: [
            Query.equal('userId', userId),
            Query.equal('nameLower', nameLower),
            Query.limit(1),
          ],
        })
        .catch(() => ({ rows: [] as any[] }));

      if (existing.rows && existing.rows.length > 0) {
        const row = existing.rows[0];
        await tables
          .updateRow({
            databaseId: DB,
            tableId: TAGS_TABLE,
            rowId: row.$id,
            data: {
              usageCount: (row.usageCount || 0) + 1,
              updatedAt: now,
            },
          })
          .catch(() => null);
      } else {
        await tables
          .createRow({
            databaseId: DB,
            tableId: TAGS_TABLE,
            rowId: ID.unique(),
            data: {
              name,
              nameLower,
              userId,
              isPublic: false,
              isGuest: false,
              usageCount: 1,
              metadata: JSON.stringify({ color: '#A855F7', description: '' }),
              createdAt: now,
              updatedAt: now,
            },
            permissions: [Permission.read(Role.any()), Permission.update(Role.user(userId))],
          })
          .catch(() => null);
      }
    } catch (err) {
      console.warn(`[ApiResources] Failed to ensure tag '${name}':`, err);
    }
  }

  return cleanTags;
}

async function getWorkspaceObjectIds(
  tables: ReturnType<typeof createSystemTablesDB>,
  projectId: string,
  entityKind?: string
): Promise<string[]> {
  try {
    const queries = [Query.equal('projectId', projectId), Query.limit(100)];
    if (entityKind) queries.push(Query.equal('entityKind', entityKind));
    const res = await tables.listRows({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      queries,
    }).catch(() => ({ rows: [] as any[] }));
    return (res.rows || []).map((r: any) => r.entityId).filter(Boolean);
  } catch {
    return [];
  }
}

async function getAllLinkedWorkspaceObjectIds(
  tables: ReturnType<typeof createSystemTablesDB>,
  entityKind: string
): Promise<Set<string>> {
  try {
    const res = await tables.listRows({
      databaseId: CHAT_DB,
      tableId: PROJECT_OBJECTS,
      queries: [Query.equal('entityKind', entityKind), Query.limit(500)],
    }).catch(() => ({ rows: [] as any[] }));
    return new Set((res.rows || []).map((r: any) => r.entityId).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function resolveWorkspaceMekBytes(
  tables: any,
  actor: ApiActor,
  opts?: { workspaceId?: string | null; agentId?: string | null; mek?: string | null }
): Promise<Uint8Array | null> {
  if (opts?.mek) {
    try {
      return parseMekToBytes(opts.mek);
    } catch {}
  }

  let targetAgentId = opts?.agentId ? String(opts.agentId).replace(/^agent_/, '') : null;

  // 1. Check agentic workspace by workspaceId
  if (!targetAgentId && opts?.workspaceId) {
    try {
      const proj = (await tables
        .getRow({
          databaseId: FLOW_DB,
          tableId: (APPWRITE_CONFIG.TABLES as any).PROJECTS || 'projects',
          rowId: opts.workspaceId,
        })
        .catch(() => null)) as any;

      if (proj) {
        if (proj.isAgentic || proj.agentId) {
          targetAgentId = String(proj.agentId || proj.ownerId).replace(/^agent_/, '');
        }
        if (!targetAgentId && proj.metadata) {
          try {
            const meta = typeof proj.metadata === 'string' ? JSON.parse(proj.metadata) : proj.metadata;
            if (meta.agentId) targetAgentId = String(meta.agentId).replace(/^agent_/, '');
          } catch {}
        }
      }
    } catch {}
  }

  if (targetAgentId) {
    // A. Check agents table
    try {
      const agentRow = (await tables
        .getRow({
          databaseId: FLOW_DB,
          tableId: APPWRITE_CONFIG.TABLES.FLOW.AGENTS,
          rowId: targetAgentId,
        })
        .catch(() => null)) as any;

      if (agentRow?.config) {
        const parsed = JSON.parse(agentRow.config);
        if (parsed.mekHex) return parseMekToBytes(parsed.mekHex);
        if (parsed.entropyHex) return parseMekToBytes(parsed.entropyHex);
      }
    } catch {}

    // B. Check profiles table
    try {
      const profileRow = (await tables
        .getRow({
          databaseId: CHAT_DB,
          tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          rowId: `agent_${targetAgentId}`,
        })
        .catch(() => null)) as any;

      if (profileRow?.preferences) {
        const pref = typeof profileRow.preferences === 'string' ? JSON.parse(profileRow.preferences) : profileRow.preferences;
        if (pref.mekHex) return parseMekToBytes(pref.mekHex);
        if (pref.entropyHex) return parseMekToBytes(pref.entropyHex);
      }
    } catch {}
  }

  // C. Check local filesystem sovereign store (~/.kylrix/agents/)
  if (typeof process !== 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const agentsDir = path.join(os.homedir(), '.kylrix', 'agents');
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const fullPath = path.join(agentsDir, file);
            const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (
              ((targetAgentId && (content.agentId === targetAgentId || content.agentUserId === `agent_${targetAgentId}`)) ||
                (opts?.workspaceId && (content.workspaceId === opts.workspaceId || content.defaultWorkspaceId === opts.workspaceId))) &&
              content.mekHex
            ) {
              return parseMekToBytes(content.mekHex);
            }
          }
        }
      }
    } catch {}
  }

  return null;
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

  async listNotes(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'notes:read');
    const tables = createSystemTablesDB();
    const { isExcludedNote, ideaListExclusionQueries } = await import('@/lib/appwrite/note');

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const noteIds = await getWorkspaceObjectIds(tables, wsId, 'note');

      const seen = new Set<string>();
      const rows: any[] = [];

      for (const nid of noteIds) {
        if (seen.has(nid)) continue;
        seen.add(nid);
        const row = (await tables
          .getRow({ databaseId: DB, tableId: NOTES, rowId: nid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest) && !isExcludedNote(row)) {
          rows.push(shapeNote(row));
        }
      }

      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    // Personal workspace: strictly exclude items belonging to ANY real workspace
    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'note');
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
    return res.rows
      .filter((r: any) => !isExcludedNote(r) && !linkedIds.has(r.$id))
      .map(shapeNote);
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
    const wsId = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
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

    const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const isGuest = body?.isGuest !== undefined ? Boolean(body.isGuest) : (body?.isPublic !== undefined ? Boolean(body.isPublic) : true);

    const cleanTags = await ensureTagsExist(tables, actor.userId, body?.tags as any[]);

    const note = await service.createNote({
      title,
      content,
      format: 'markdown',
      isPublic,
      isGuest,
      isWorkspace: Boolean(wsId),
      projectId: wsId || undefined,
      tags: cleanTags.length ? cleanTags : undefined,
    });

    // Ensure ownership and workspace isolation metadata exist
    const noteId = (note as any).$id;
    await tables.updateRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: noteId,
      data: {
        userId: actor.userId,
        creatorId: actor.userId,
        isPublic,
        isGuest,
        isWorkspace: Boolean(wsId),
        projectId: wsId || null,
        tags: cleanTags,
        updatedAt: now,
      },
    }).catch(() => null);

    // Link into project_objects join table
    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'note', noteId, actor.userId, { title });
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
    if (body.isPublic !== undefined) patch.isPublic = Boolean(body.isPublic);
    if (body.isGuest !== undefined) patch.isGuest = Boolean(body.isGuest);
    if (body.tags !== undefined) {
      patch.tags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
    }

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
    await tables.updateRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: id,
      data: {
        isTrash: true,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'note', id);
    return { id, deleted: true, trashed: true };
  },

  async listGoals(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'goals:read');
    const tables = createSystemTablesDB();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const goalIds = await getWorkspaceObjectIds(tables, wsId, 'goal');

      const seen = new Set<string>();
      const rows: any[] = [];

      for (const gid of goalIds) {
        if (seen.has(gid)) continue;
        seen.add(gid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: gid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push(shapeGoal(row));
        }
      }

      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    // Personal workspace: strictly exclude items belonging to ANY real workspace
    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'goal');
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: TASKS,
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !linkedIds.has(r.$id))
      .map(shapeGoal);
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
    const wsId = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    const tables = createSystemTablesDB();
    const goalId = ID.unique();

    const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const isGuest = body?.isGuest !== undefined ? Boolean(body.isGuest) : (body?.isPublic !== undefined ? Boolean(body.isPublic) : true);

    const cleanTags = body?.tags !== undefined ? await ensureTagsExist(tables, actor.userId, body.tags as any[]) : undefined;

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: goalId,
      data: {
        title: title.slice(0, 255),
        description: body?.description != null ? String(body.description) : (body?.summary != null ? String(body.summary) : ''),
        status: String(body?.status || 'todo'),
        tags: cleanTags && cleanTags.length > 0 ? cleanTags : undefined,
        userId: actor.userId,
        isPublic,
        isGuest,
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'goal', goalId, actor.userId, { title });
    }

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
    if (body.isPublic !== undefined) patch.isPublic = Boolean(body.isPublic);
    if (body.isGuest !== undefined) patch.isGuest = Boolean(body.isGuest);
    if (body.tags !== undefined) {
      patch.tags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
    }
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
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: id,
      data: {
        isTrash: true,
        isDeleted: true,
        status: 'trash',
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'goal', id);
    return { id, deleted: true, trashed: true };
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

  async createAgentKey(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('pats:write') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('agents:provision')) {
      requireScope(actor, 'pats:write');
    }
    const name = String(body.name || 'Agent Provisioning Key').trim().slice(0, 128);
    // Root Agent Provisioning Keys have the sole purpose of provisioning agents & minting agentic PATs
    const scopes: PatScope[] = ['agents:provision'];
    
    return PatService.create({
      userId: actor.userId,
      name,
      scopes,
      keyCategory: 'agent_provisioning_key',
      expiresAt: body.expiresAt != null ? String(body.expiresAt) : null,
    });
  },

  async initAgentIdentity(actor: ApiActor, targetAgentId: string, body: Record<string, unknown> = {}) {
    if (!actor.scopes.includes('agents:provision') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('pats:write')) {
      requireScope(actor, 'agents:provision');
    }
    const agentId = String(targetAgentId || '').trim();
    if (!agentId) {
      const err = new Error('Missing required agentId');
      (err as any).status = 400;
      throw err;
    }
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();

    // 1. Check if agent already exists in agents table
    const existingAgentRow = await tables.getRow({
      databaseId: FLOW_DB,
      tableId: 'agents',
      rowId: agentId,
    }).catch(() => null);

    if (existingAgentRow) {
      if (existingAgentRow.ownerId && existingAgentRow.ownerId !== actor.userId) {
        const err = new Error('Forbidden: You do not own this agent');
        (err as any).status = 403;
        throw err;
      }
      // If keys already initialized and forceReset is not requested, prevent accidental rewriting
      if (existingAgentRow.publicKey && !body.forceReset && !body.reset) {
        let parsedConfig: Record<string, any> = {};
        try {
          parsedConfig = JSON.parse(existingAgentRow.config || '{}');
        } catch {}
        if (parsedConfig.walletAddress) {
          const err = new Error('Conflict: Sovereign cryptographic identity is already sealed for this agent. Pass forceReset: true to regenerate.');
          (err as any).status = 409;
          (err as any).code = 'identity_already_sealed';
          (err as any).data = {
            agentId,
            agentUserId: `agent_${agentId}`,
            username: parsedConfig.username,
            name: parsedConfig.name,
            walletAddress: parsedConfig.walletAddress,
            nostrNpub: existingAgentRow.publicKey,
            publicKey: existingAgentRow.publicKey,
            workspaceId: parsedConfig.workspaceId,
          };
          throw err;
        }
      }
    }

    // 2. Generate autonomous keys, BIP39 mnemonic & multi-chain wallets
    const name = String(body.name || 'Autonomous Agent').trim().slice(0, 128);
    const agentType = String(body.agentType || 'autonomous').trim().slice(0, 64);
    const crypto = await this.deriveAgentSovereignCrypto(typeof body.mnemonic === 'string' ? body.mnemonic : undefined);

    const agentUserId = `agent_${agentId}`;
    const cleanHandle = `ag_${name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || agentId.slice(0, 8)}`;

    // 3. Resolve or create workspace
    let workspaceId = body.workspaceId ? String(body.workspaceId) : null;
    let workspaceTitle = String(body.initialWorkspaceTitle || `${name}'s Workspace`).trim().slice(0, 255);

    if (!workspaceId) {
      const wsRow = await tables.createRow({
        databaseId: FLOW_DB,
        tableId: 'projects',
        rowId: ID.unique(),
        data: {
          title: workspaceTitle,
          summary: `Autonomous workspace for agent ${name}`,
          ownerId: actor.userId,
          visibility: 'private',
          status: 'active',
          isAgentic: true,
          isPublic: false,
          isGuest: false,
          createdAt: now,
          updatedAt: now,
        },
        permissions: [Permission.read(Role.user(actor.userId))],
      }).catch(() => null);
      if (wsRow) workspaceId = (wsRow as any).$id;
    }

    // 4. Save to agents table
    if (existingAgentRow) {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'agents',
        rowId: agentId,
        data: {
          publicKey: crypto.nostrNpub,
          config: JSON.stringify({
            name,
            agentType,
            agentUserId,
            username: cleanHandle,
            walletAddress: crypto.walletAddressJson,
            walletMap: crypto.walletMap,
            nostrNpub: crypto.nostrNpub,
            workspaceId,
            capabilities: body.capabilities || ['notes', 'goals', 'chats', 'nostr'],
            updatedAt: now,
          }),
          status: 'active',
        },
      }).catch(() => null);
    } else {
      await tables.createRow({
        databaseId: FLOW_DB,
        tableId: 'agents',
        rowId: agentId,
        data: {
          ownerId: actor.userId,
          publicKey: crypto.nostrNpub,
          config: JSON.stringify({
            name,
            agentType,
            agentUserId,
            username: cleanHandle,
            walletAddress: crypto.walletAddressJson,
            walletMap: crypto.walletMap,
            nostrNpub: crypto.nostrNpub,
            workspaceId,
            capabilities: body.capabilities || ['notes', 'goals', 'chats', 'nostr'],
            createdAt: now,
          }),
          status: 'active',
          isPublic: true,
          isGuest: true,
        },
        permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
      }).catch(() => null);
    }

    // 5. Create or sync profile in profiles table
    await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      rowId: agentUserId,
      data: {
        userId: agentUserId,
        username: cleanHandle,
        displayName: `${name.trim()} (Smart Agent)`,
        bio: String(body.bio || body.goal || `Autonomous ${agentType} smart partner`),
        walletAddress: crypto.walletAddressJson,
        publicKey: crypto.nostrNpub,
        status: 'online',
        preferences: JSON.stringify({
          isAgentic: true,
          ownerId: actor.userId,
          agentId,
          agentType,
          role: String(body.role || name),
          goal: String(body.goal || ''),
          nostrNpub: crypto.nostrNpub,
          walletAddress: crypto.walletMap,
          updatedAt: now,
        }),
        isPublic: true,
        isGuest: true,
        isAvatar: true,
        isContact: true,
        isOnlineVisible: true,
      },
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
    }).catch(async () => {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        rowId: agentUserId,
        data: {
          username: cleanHandle,
          displayName: `${name.trim()} (Smart Agent)`,
          walletAddress: crypto.walletAddressJson,
          publicKey: crypto.nostrNpub,
          status: 'online',
          preferences: JSON.stringify({
            isAgentic: true,
            ownerId: actor.userId,
            agentId,
            agentType,
            role: String(body.role || name),
            goal: String(body.goal || ''),
            nostrNpub: crypto.nostrNpub,
            walletAddress: crypto.walletMap,
            updatedAt: now,
          }),
        },
      }).catch(() => null);
    });

    return {
      agentId,
      agentUserId,
      username: cleanHandle,
      name,
      agentType,
      workspaceId,
      workspaceTitle,
      mnemonic: crypto.mnemonic,
      walletAddress: crypto.walletAddressJson,
      walletMap: crypto.walletMap,
      nostrNpub: crypto.nostrNpub,
      nostrNsec: crypto.nostrNsec,
      mekHex: crypto.mekHex,
      publicKey: crypto.nostrNpub,
      ownerId: actor.userId,
      createdAt: now,
    };
  },

  async provisionAgent(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('agents:provision') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('pats:write')) {
      requireScope(actor, 'agents:provision');
    }
    
    const targetAgentId = body.agentId ? String(body.agentId).trim() : ID.unique();
    const initResult = await this.initAgentIdentity(actor, targetAgentId, body);

    const name = String(body.name || initResult.name || 'Autonomous Agent').trim().slice(0, 128);
    const agentScopes = Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes
      : [
          'workspaces:read',
          'workspaces:write',
          'notes:read',
          'notes:write',
          'goals:read',
          'goals:write',
          'vault:read',
          'vault:write',
          'trash:read',
          'trash:write',
          'chats:read',
          'chats:write',
          'agents:read',
          'agents:write',
        ];

    const agentPatResult = await PatService.create({
      userId: actor.userId,
      name: `${name} (Agentic PAT)`,
      scopes: agentScopes,
      keyCategory: 'agentic_pat',
      agentId: initResult.agentId,
    });

    return {
      ...initResult,
      agentToken: agentPatResult.token,
    };
  },

  async listWorkspaces(actor: ApiActor, limit = 25) {
    requireScope(actor, 'workspaces:read');
    const tables = createSystemTablesDB();
    
    // 1. Owned workspaces
    const ownedRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'projects',
      queries: [
        Query.equal('ownerId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });

    const ownedList = ownedRes.rows.map((r: any) => ({
      id: r.$id,
      title: r.title || r.name || 'Untitled',
      summary: r.summary || r.description || null,
      visibility: r.visibility || null,
      isAgentic: Boolean(r.isAgentic),
      isShared: false,
      role: 'owner',
      updatedAt: r.$updatedAt || r.updatedAt || null,
      createdAt: r.$createdAt || r.createdAt || null,
    }));

    // 2. Workspaces where user/agent is a collaborator
    const collabRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
      queries: [
        Query.equal('userId', actor.userId),
        Query.equal('resourceType', 'project'),
        Query.equal('status', 'accepted'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    const sharedList: any[] = [];
    for (const c of collabRes.rows) {
      if (ownedList.some((w) => w.id === c.resourceId)) continue;
      const ws = (await tables
        .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: c.resourceId })
        .catch(() => null)) as any;
      if (ws) {
        sharedList.push({
          id: ws.$id,
          title: ws.title || ws.name || 'Untitled',
          summary: ws.summary || ws.description || null,
          visibility: ws.visibility || null,
          isAgentic: Boolean(ws.isAgentic),
          isShared: true,
          role: c.permission || 'writer',
          updatedAt: ws.$updatedAt || ws.updatedAt || null,
          createdAt: ws.$createdAt || ws.createdAt || null,
        });
      }
    }

    return [...ownedList, ...sharedList];
  },

  async getWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:read');
    const tables = createSystemTablesDB();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Workspace not found');

    let isCollab = false;
    let role = 'owner';
    if (row.ownerId !== actor.userId) {
      const collabRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
        queries: [
          Query.equal('resourceId', id),
          Query.equal('userId', actor.userId),
          Query.equal('status', 'accepted'),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      if (collabRes.rows.length === 0 && !row.isPublic) {
        notFound('Workspace not found');
      }
      isCollab = true;
      role = collabRes.rows[0]?.permission || 'viewer';
    }

    return {
      id: row.$id,
      title: row.title || row.name || 'Untitled',
      summary: row.summary || row.description || null,
      visibility: row.visibility || null,
      isAgentic: Boolean(row.isAgentic),
      isShared: isCollab,
      role,
      updatedAt: row.$updatedAt || row.updatedAt || null,
      createdAt: row.$createdAt || row.createdAt || null,
    };
  },

  async addWorkspaceCollaborator(actor: ApiActor, workspaceId: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, workspaceId);
    const targetUserId = String(body.userId || body.agentId || '').trim();
    if (!targetUserId) badRequest('userId or agentId required');
    const permission = String(body.permission || 'write').toLowerCase();
    if (!['read', 'write', 'admin'].includes(permission)) {
      badRequest('permission must be read, write, or admin');
    }

    const tables = createSystemTablesDB();
    const FLOW_DATABASE_ID = FLOW_DB;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const now = new Date().toISOString();

    // Check existing
    const existing = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', workspaceId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', targetUserId),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    if (existing.rows.length > 0) {
      const updated = await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existing.rows[0].$id,
        data: {
          permission,
          status: 'accepted',
          updatedAt: now,
        },
      });
      return {
        id: (updated as any).$id,
        workspaceId,
        userId: targetUserId,
        permission,
        status: 'accepted',
      };
    }

    const created = await tables.createRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: ID.unique(),
      data: {
        resourceId: workspaceId,
        resourceType: 'project',
        userId: targetUserId,
        permission,
        inviterId: actor.userId,
        status: 'accepted',
        invitedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.read(Role.user(targetUserId)),
      ],
    });

    return {
      id: (created as any).$id,
      workspaceId,
      userId: targetUserId,
      permission,
      status: 'accepted',
    };
  },

  async listWorkspaceCollaborators(actor: ApiActor, workspaceId: string) {
    requireScope(actor, 'workspaces:read');
    await this.getWorkspace(actor, workspaceId);
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
      queries: [
        Query.equal('resourceId', workspaceId),
        Query.equal('resourceType', 'project'),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    return res.rows.map((r: any) => ({
      id: r.$id,
      userId: r.userId,
      permission: r.permission,
      status: r.status,
      inviterId: r.inviterId || null,
      invitedAt: r.invitedAt || null,
    }));
  },

  async listEvents(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'events:read');
    const tables = createSystemTablesDB();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const eventIds = await getWorkspaceObjectIds(tables, wsId, 'event');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const eid of eventIds) {
        if (seen.has(eid)) continue;
        seen.add(eid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'events', rowId: eid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push({
            id: row.$id,
            title: row.title || row.name || 'Untitled',
            startsAt: row.startsAt || row.startAt || null,
            endsAt: row.endsAt || row.endAt || null,
            updatedAt: row.$updatedAt || null,
          });
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'event');
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'events',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => ({
        id: r.$id,
        title: r.title || r.name || 'Untitled',
        startsAt: r.startsAt || r.startAt || null,
        endsAt: r.endsAt || r.endAt || null,
        updatedAt: r.$updatedAt || null,
      }));
  },

  async listForms(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'forms:read');
    const tables = createSystemTablesDB();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const formIds = await getWorkspaceObjectIds(tables, wsId, 'form');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const fid of formIds) {
        if (seen.has(fid)) continue;
        seen.add(fid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: fid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push({
            id: row.$id,
            title: row.title || row.name || 'Untitled',
            updatedAt: row.$updatedAt || null,
            isPublic: !!row.isPublic,
          });
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'form');
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'forms',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => ({
        id: r.$id,
        title: r.title || r.name || 'Untitled',
        updatedAt: r.$updatedAt || null,
        isPublic: !!r.isPublic,
      }));
  },

  async listAgentSessions(actor: ApiActor, limit = 25, opts?: { harness?: string | null; workspaceId?: string | null }) {
    requireScope(actor, 'agents:read');
    const tables = createSystemTablesDB();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const sessionIds = await getWorkspaceObjectIds(tables, wsId, 'agent_session');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const sid of sessionIds) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: sid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push({
            id: row.$id,
            harness: row.harness || null,
            isPublic: !!row.isPublic,
            isPinned: !!row.isPinned,
            seen: !!row.seen,
            updatedAt: row.$updatedAt || null,
            createdAt: row.$createdAt || null,
          });
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'agent_session');
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
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => ({
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
    const wsId = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const sessionId = ID.unique();
    const title = String(body.title || `[${harness}] mirror`).slice(0, 200);
    const seed = {
      role: 'system',
      content: `Harness mirror session for ${harness}. Read-only prompts/tool calls land here.`,
      at: now,
    };
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      rowId: sessionId,
      data: {
        userId: actor.userId,
        harness,
        context: title,
        chatHistory: JSON.stringify([seed]),
        seen: false,
        isMemory: false,
        isPublic: Boolean(wsId),
        isGuest: Boolean(wsId),
        isPinned: false,
        ...(wsId ? { isWorkspace: true, projectId: wsId } : {}),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'agent_session', sessionId, actor.userId, { title });
    }

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

  async createChat(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const participantId = String(body.participantId || body.recipientId || body.userId || '').trim();
    if (!participantId) badRequest('participantId or recipientId required');
    const tables = createSystemTablesDB();
    const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
    const convTable = APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || APPWRITE_CONFIG.TABLES.CHAT?.CONVERSATIONS || 'conversations';

    // 1. Check existing direct conversation
    const existing = await tables.listRows({
      databaseId: chatDb,
      tableId: convTable,
      queries: [
        Query.contains('participants', actor.userId),
        Query.contains('participants', participantId),
        Query.limit(5),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    let conv = (existing.rows || []).find((c: any) => {
      const parts = Array.isArray(c.participants) ? c.participants : [];
      return parts.length === 2 && parts.includes(actor.userId) && parts.includes(participantId);
    });

    const now = new Date().toISOString();

    if (!conv) {
      // 2. Check if recipient has published public key
      const profiles = await tables.listRows({
        databaseId: chatDb,
        tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        queries: [
          Query.equal('userId', participantId),
          Query.limit(1),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      const recProfile = profiles.rows?.[0] as any;
      const hasPublicKey = Boolean(recProfile?.publicKey);
      const isEncrypted = body.isEncrypted !== undefined ? Boolean(body.isEncrypted) : hasPublicKey;

      conv = await tables.createRow({
        databaseId: chatDb,
        tableId: convTable,
        rowId: ID.unique(),
        data: {
          type: 'direct',
          name: body.name ? String(body.name).slice(0, 100) : null,
          participants: [actor.userId, participantId],
          participantCount: 2,
          isEncrypted,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        },
        permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(actor.userId)),
          Permission.update(Role.user(participantId)),
        ],
      });
    }

    // 3. Send initial message if provided
    const initialText = String(body.initialMessage || body.message || body.content || '').trim();
    if (initialText) {
      await this.sendChatMessage(actor, (conv as any).$id, { content: initialText }).catch(() => null);
    }

    return {
      id: (conv as any).$id,
      type: (conv as any).type || 'direct',
      participants: (conv as any).participants || [actor.userId, participantId],
      isEncrypted: !!(conv as any).isEncrypted,
      createdAt: (conv as any).createdAt || now,
    };
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
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    // Update conversation lastMessageAt
    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || 'conversations',
      rowId: conversationId,
      data: {
        lastMessageAt: now,
        updatedAt: now,
      },
    }).catch(() => null);

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
        isAgentic: Boolean(body.isAgentic),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
    });
    return {
      id: (row as any).$id,
      title: (row as any).title,
      summary: (row as any).summary || null,
      visibility: (row as any).visibility || null,
      isAgentic: Boolean((row as any).isAgentic),
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
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'events',
      rowId: id,
      data: {
        isDeleted: true,
        isTrash: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return { id, deleted: true, trashed: true };
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
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'forms',
      rowId: id,
      data: {
        isDeleted: true,
        isTrash: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return { id, deleted: true, trashed: true };
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

  async listVaultItems(
    actor: ApiActor,
    limit = 25,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = createSystemTablesDB();
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const lim = Math.min(100, Math.max(1, limit));

    let rows: any[] = [];

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const credIds = await getWorkspaceObjectIds(tables, wsId, 'credential');
      const seen = new Set<string>();

      for (const cid of credIds) {
        if (seen.has(cid)) continue;
        seen.add(cid);
        const row = (await tables
          .getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
            rowId: cid,
          })
          .catch(() => null)) as any;

        if (row && row.userId === actor.userId && !row.isDeleted) {
          rows.push(row);
        }
      }
      rows = rows.slice(0, lim);
    } else {
      const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'credential');
      const res = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', false),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      });

      rows = res.rows.filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id));
    }

    return Promise.all(
      rows.map(async (r: any) => {
        const unsealed = mekBytes
          ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.credentials, mekBytes)
          : {};

        const rawName = unsealed.name ?? r.name ?? '';
        const name = looksEncrypted(rawName) && !mekBytes ? 'Protected Secret' : (rawName || 'Untitled');
        const username = unsealed.username !== undefined ? unsealed.username : (looksEncrypted(r.username) && !mekBytes ? null : r.username ?? null);
        const url = unsealed.url !== undefined ? unsealed.url : (looksEncrypted(r.url) && !mekBytes ? null : r.url ?? null);

        return {
          id: r.$id,
          name,
          itemType: r.itemType || 'login',
          url,
          username,
          folderId: r.folderId || null,
          isFavorite: !!r.isFavorite,
          isPinned: !!r.isPinned,
          tags: Array.isArray(r.tags) ? r.tags : [],
          updatedAt: r.$updatedAt || r.updatedAt || null,
          createdAt: r.$createdAt || r.createdAt || null,
          hasSecret: !!(r.password || r.cardNumber),
          ...(unsealed.password ? { secret: unsealed.password, password: unsealed.password } : {}),
          ...(unsealed.notes ? { notes: unsealed.notes } : {}),
          ...(unsealed.customFields ? { customFields: unsealed.customFields } : {}),
          ...(unsealed.cardNumber ? { cardNumber: unsealed.cardNumber } : {}),
          ...(unsealed.cardholderName ? { cardholderName: unsealed.cardholderName } : {}),
          ...(unsealed.cardExpiry ? { cardExpiry: unsealed.cardExpiry } : {}),
          ...(unsealed.cardCVV ? { cardCVV: unsealed.cardCVV } : {}),
          ...(unsealed.cardPIN ? { cardPIN: unsealed.cardPIN } : {}),
        };
      }),
    );
  },

  async getVaultItem(
    actor: ApiActor,
    id: string,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = createSystemTablesDB();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || r.userId !== actor.userId || r.isDeleted) notFound('Vault item not found');

    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const unsealed = mekBytes
      ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.credentials, mekBytes)
      : {};

    const rawName = unsealed.name ?? r.name ?? '';
    const name = looksEncrypted(rawName) && !mekBytes ? 'Protected Secret' : (rawName || 'Untitled');
    const username = unsealed.username !== undefined ? unsealed.username : (looksEncrypted(r.username) && !mekBytes ? null : r.username ?? null);
    const url = unsealed.url !== undefined ? unsealed.url : (looksEncrypted(r.url) && !mekBytes ? null : r.url ?? null);

    return {
      id: r.$id,
      name,
      itemType: r.itemType || 'login',
      url,
      username,
      folderId: r.folderId || null,
      isFavorite: !!r.isFavorite,
      isPinned: !!r.isPinned,
      tags: Array.isArray(r.tags) ? r.tags : [],
      updatedAt: r.$updatedAt || r.updatedAt || null,
      createdAt: r.$createdAt || r.createdAt || null,
      hasSecret: !!(r.password || r.cardNumber),
      ...(unsealed.password ? { secret: unsealed.password, password: unsealed.password } : {}),
      ...(unsealed.notes ? { notes: unsealed.notes } : {}),
      ...(unsealed.customFields ? { customFields: unsealed.customFields } : {}),
      ...(unsealed.cardNumber ? { cardNumber: unsealed.cardNumber } : {}),
      ...(unsealed.cardholderName ? { cardholderName: unsealed.cardholderName } : {}),
      ...(unsealed.cardExpiry ? { cardExpiry: unsealed.cardExpiry } : {}),
      ...(unsealed.cardCVV ? { cardCVV: unsealed.cardCVV } : {}),
      ...(unsealed.cardPIN ? { cardPIN: unsealed.cardPIN } : {}),
    };
  },

  async createVaultItem(
    actor: ApiActor,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const name = String(body.name || body.title || '').trim();
    if (!name) badRequest('name required');

    const tables = createSystemTablesDB();
    const wsId = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const agId = (body.agentId || opts?.agentId) as string | undefined;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
      workspaceId: wsId,
      agentId: agId,
      mek: opts?.mek || (body.mek as string),
    });

    if (!mekBytes) {
      const err = new Error('Vault creation requires MEK or an Agentic Workspace context (pass X-Kylrix-MEK, mek, or workspaceId)');
      (err as any).status = 400;
      (err as any).code = 'mek_required';
      throw err;
    }

    let rawSecret = body.secret != null ? String(body.secret) : (body.password != null ? String(body.password) : '');
    let wasGenerated = false;

    if (!rawSecret && (body.itemType === 'login' || !body.itemType || body.type === 'login')) {
      const genOptions = (body.generateOptions && typeof body.generateOptions === 'object' ? body.generateOptions : {}) as any;
      rawSecret = generateRandomVaultSecret(genOptions);
      wasGenerated = true;
    }

    const payloadToSeal: Record<string, any> = {
      name,
      username: body.username != null ? String(body.username) : null,
      password: rawSecret || null,
      url: body.url != null ? String(body.url) : null,
      notes: body.notes != null ? String(body.notes) : null,
      customFields: body.customFields != null ? (typeof body.customFields === 'object' ? JSON.stringify(body.customFields) : String(body.customFields)) : null,
      cardNumber: body.cardNumber != null ? String(body.cardNumber) : null,
      cardholderName: body.cardholderName != null ? String(body.cardholderName) : null,
      cardExpiry: body.cardExpiry != null ? String(body.cardExpiry) : null,
      cardCVV: body.cardCVV != null ? String(body.cardCVV) : null,
      cardPIN: body.cardPIN != null ? String(body.cardPIN) : null,
    };

    const { encryptedFields, wrappedDek } = await sealRowFields(
      payloadToSeal,
      VAULT_ENCRYPTED_FIELDS.credentials,
      mekBytes
    );

    const itemId = ID.unique();
    const now = new Date().toISOString();
    const itemType = String(body.itemType || body.type || 'login').slice(0, 50);

    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: itemId,
      data: {
        userId: actor.userId,
        name: encryptedFields.name || name.slice(0, 100),
        username: encryptedFields.username ?? null,
        password: encryptedFields.password ?? null,
        dek: wrappedDek,
        url: encryptedFields.url ?? null,
        notes: encryptedFields.notes ?? null,
        customFields: encryptedFields.customFields ?? null,
        cardNumber: encryptedFields.cardNumber ?? null,
        cardholderName: encryptedFields.cardholderName ?? null,
        cardExpiry: encryptedFields.cardExpiry ?? null,
        cardCVV: encryptedFields.cardCVV ?? null,
        cardPIN: encryptedFields.cardPIN ?? null,
        itemType,
        folderId: body.folderId != null ? String(body.folderId) : null,
        isFavorite: body.isFavorite === true,
        isPinned: body.isPinned === true,
        isDeleted: false,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'credential', itemId, actor.userId, { title: name });
    }

    return {
      id: (row as any).$id,
      name,
      username: body.username != null ? String(body.username) : null,
      itemType,
      url: body.url != null ? String(body.url) : null,
      folderId: (row as any).folderId,
      isFavorite: !!(row as any).isFavorite,
      isPinned: !!(row as any).isPinned,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      secret: rawSecret || null,
      password: rawSecret || null,
      notes: body.notes != null ? String(body.notes) : null,
      customFields: body.customFields ?? null,
      cardNumber: body.cardNumber != null ? String(body.cardNumber) : null,
      cardholderName: body.cardholderName != null ? String(body.cardholderName) : null,
      cardExpiry: body.cardExpiry != null ? String(body.cardExpiry) : null,
      cardCVV: body.cardCVV != null ? String(body.cardCVV) : null,
      cardPIN: body.cardPIN != null ? String(body.cardPIN) : null,
      generated: wasGenerated,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateVaultItem(
    actor: ApiActor,
    id: string,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const tables = createSystemTablesDB();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('Vault item not found');

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.itemType !== undefined) patch.itemType = String(body.itemType).slice(0, 50);
    if (body.folderId !== undefined) patch.folderId = body.folderId == null ? null : String(body.folderId);
    if (body.isFavorite !== undefined) patch.isFavorite = !!body.isFavorite;
    if (body.isPinned !== undefined) patch.isPinned = !!body.isPinned;
    if (body.tags !== undefined && Array.isArray(body.tags)) patch.tags = body.tags.map(String);

    const hasEncryptedField =
      body.name !== undefined ||
      body.username !== undefined ||
      body.url !== undefined ||
      body.secret !== undefined ||
      body.password !== undefined ||
      body.notes !== undefined ||
      body.customFields !== undefined ||
      body.cardNumber !== undefined ||
      body.cardholderName !== undefined ||
      body.cardExpiry !== undefined ||
      body.cardCVV !== undefined ||
      body.cardPIN !== undefined;

    if (hasEncryptedField) {
      const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
        workspaceId: (body.workspaceId || body.projectId || opts?.workspaceId) as string,
        agentId: (body.agentId || opts?.agentId) as string,
        mek: opts?.mek || (body.mek as string),
      });

      if (!mekBytes) {
        badRequest('Updating encrypted vault fields requires MEK header X-Kylrix-MEK, mek body property, or agentic workspace context');
      }

      const payloadToSeal: Record<string, any> = {};
      if (body.name !== undefined) payloadToSeal.name = String(body.name).trim();
      if (body.username !== undefined) payloadToSeal.username = body.username == null ? null : String(body.username);
      if (body.url !== undefined) payloadToSeal.url = body.url == null ? null : String(body.url);
      if (body.secret !== undefined || body.password !== undefined) {
        payloadToSeal.password = String(body.secret ?? body.password ?? '');
      }
      if (body.notes !== undefined) payloadToSeal.notes = body.notes == null ? null : String(body.notes);
      if (body.customFields !== undefined) {
        payloadToSeal.customFields = body.customFields == null ? null : (typeof body.customFields === 'object' ? JSON.stringify(body.customFields) : String(body.customFields));
      }
      if (body.cardNumber !== undefined) payloadToSeal.cardNumber = body.cardNumber == null ? null : String(body.cardNumber);
      if (body.cardholderName !== undefined) payloadToSeal.cardholderName = body.cardholderName == null ? null : String(body.cardholderName);
      if (body.cardExpiry !== undefined) payloadToSeal.cardExpiry = body.cardExpiry == null ? null : String(body.cardExpiry);
      if (body.cardCVV !== undefined) payloadToSeal.cardCVV = body.cardCVV == null ? null : String(body.cardCVV);
      if (body.cardPIN !== undefined) payloadToSeal.cardPIN = body.cardPIN == null ? null : String(body.cardPIN);

      const { encryptedFields, wrappedDek } = await sealRowFields(
        payloadToSeal,
        Object.keys(payloadToSeal),
        mekBytes,
        existing.dek
      );

      Object.assign(patch, encryptedFields);
      patch.dek = wrappedDek;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: id,
      data: patch as any,
    });

    return this.getVaultItem(actor, id, opts);
  },

  async deleteVaultItem(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = createSystemTablesDB();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('Vault item not found');

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: id,
      data: {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'credential', id);

    return { id, deleted: true, trashed: true };
  },

  // --- TOTP Secrets ---
  async listTotpSecrets(
    actor: ApiActor,
    limit = 50,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = createSystemTablesDB();
    const lim = Math.min(100, Math.max(1, limit));
    const wsId = opts?.workspaceId;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);

    let rows: any[] = [];
    if (wsId) {
      const totpIds = await getWorkspaceObjectIds(tables, wsId, 'totp');
      const seen = new Set<string>();

      for (const tid of totpIds) {
        if (seen.has(tid)) continue;
        seen.add(tid);
        const row = (await tables
          .getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
            rowId: tid,
          })
          .catch(() => null)) as any;

        if (row && row.userId === actor.userId && !row.isDeleted) {
          rows.push(row);
        }
      }
      rows = rows.slice(0, lim);
    } else {
      const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'totp');
      const res = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', false),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      });

      rows = res.rows.filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id));
    }

    return Promise.all(
      rows.map(async (r: any) => {
        const unsealed = mekBytes
          ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.totpSecrets, mekBytes)
          : {};

        const rawIssuer = unsealed.issuer ?? r.issuer ?? '';
        const issuer = looksEncrypted(rawIssuer) && !mekBytes ? 'Encrypted Code' : (rawIssuer || 'Smart Code');
        const accountName = unsealed.accountName !== undefined ? unsealed.accountName : (looksEncrypted(r.accountName) && !mekBytes ? null : r.accountName ?? null);
        const url = unsealed.url !== undefined ? unsealed.url : (looksEncrypted(r.url) && !mekBytes ? null : r.url ?? null);

        return {
          id: r.$id,
          issuer,
          accountName,
          url,
          algorithm: r.algorithm || 'SHA1',
          digits: r.digits || 6,
          period: r.period || 30,
          folderId: r.folderId || null,
          isFavorite: !!r.isFavorite,
          tags: Array.isArray(r.tags) ? r.tags : [],
          updatedAt: r.$updatedAt || r.updatedAt || null,
          createdAt: r.$createdAt || r.createdAt || null,
          hasSecret: !!r.secretKey,
          ...(unsealed.secretKey ? { secretKey: unsealed.secretKey } : {}),
        };
      }),
    );
  },

  async getTotpSecret(
    actor: ApiActor,
    id: string,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = createSystemTablesDB();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || r.userId !== actor.userId || r.isDeleted) notFound('TOTP secret not found');

    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const unsealed = mekBytes
      ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.totpSecrets, mekBytes)
      : {};

    const rawIssuer = unsealed.issuer ?? r.issuer ?? '';
    const issuer = looksEncrypted(rawIssuer) && !mekBytes ? 'Encrypted Code' : (rawIssuer || 'Smart Code');
    const accountName = unsealed.accountName !== undefined ? unsealed.accountName : (looksEncrypted(r.accountName) && !mekBytes ? null : r.accountName ?? null);
    const url = unsealed.url !== undefined ? unsealed.url : (looksEncrypted(r.url) && !mekBytes ? null : r.url ?? null);

    return {
      id: r.$id,
      issuer,
      accountName,
      url,
      algorithm: r.algorithm || 'SHA1',
      digits: r.digits || 6,
      period: r.period || 30,
      folderId: r.folderId || null,
      isFavorite: !!r.isFavorite,
      tags: Array.isArray(r.tags) ? r.tags : [],
      updatedAt: r.$updatedAt || r.updatedAt || null,
      createdAt: r.$createdAt || r.createdAt || null,
      hasSecret: !!r.secretKey,
      ...(unsealed.secretKey ? { secretKey: unsealed.secretKey } : {}),
    };
  },

  async createTotpSecret(
    actor: ApiActor,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const secretKey = String(body.secretKey || body.secret || '').trim();
    if (!secretKey) badRequest('secretKey required');

    const tables = createSystemTablesDB();
    const wsId = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const agId = (body.agentId || opts?.agentId) as string | undefined;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
      workspaceId: wsId,
      agentId: agId,
      mek: opts?.mek || (body.mek as string),
    });

    if (!mekBytes) {
      const err = new Error('TOTP creation requires MEK or an Agentic Workspace context (pass X-Kylrix-MEK, mek, or workspaceId)');
      (err as any).status = 400;
      (err as any).code = 'mek_required';
      throw err;
    }

    const issuer = String(body.issuer || body.name || body.title || 'App').trim();
    const accountName = body.accountName != null ? String(body.accountName).trim() : null;
    const url = body.url != null ? String(body.url).trim() : null;

    const payloadToSeal: Record<string, any> = {
      issuer,
      accountName,
      secretKey,
      url,
    };

    const { encryptedFields, wrappedDek } = await sealRowFields(
      payloadToSeal,
      VAULT_ENCRYPTED_FIELDS.totpSecrets,
      mekBytes
    );

    const itemId = ID.unique();
    const now = new Date().toISOString();

    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
      rowId: itemId,
      data: {
        userId: actor.userId,
        issuer: encryptedFields.issuer || issuer.slice(0, 100),
        accountName: encryptedFields.accountName ?? null,
        secretKey: encryptedFields.secretKey ?? null,
        dek: wrappedDek,
        url: encryptedFields.url ?? null,
        algorithm: String(body.algorithm || 'SHA1'),
        digits: Number(body.digits || 6),
        period: Number(body.period || 30),
        folderId: body.folderId != null ? String(body.folderId) : null,
        isFavorite: body.isFavorite === true,
        isDeleted: false,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.update(Role.user(actor.userId)),
        Permission.delete(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'totp', itemId, actor.userId, { title: issuer });
    }

    return {
      id: (row as any).$id,
      issuer,
      accountName,
      url,
      algorithm: (row as any).algorithm,
      digits: (row as any).digits,
      period: (row as any).period,
      folderId: (row as any).folderId,
      isFavorite: !!(row as any).isFavorite,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      secretKey,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateTotpSecret(
    actor: ApiActor,
    id: string,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const tables = createSystemTablesDB();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('TOTP secret not found');

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.algorithm !== undefined) patch.algorithm = String(body.algorithm);
    if (body.digits !== undefined) patch.digits = Number(body.digits);
    if (body.period !== undefined) patch.period = Number(body.period);
    if (body.folderId !== undefined) patch.folderId = body.folderId == null ? null : String(body.folderId);
    if (body.isFavorite !== undefined) patch.isFavorite = !!body.isFavorite;
    if (body.tags !== undefined && Array.isArray(body.tags)) patch.tags = body.tags.map(String);

    const hasEncryptedField =
      body.issuer !== undefined ||
      body.name !== undefined ||
      body.accountName !== undefined ||
      body.secretKey !== undefined ||
      body.secret !== undefined ||
      body.url !== undefined;

    if (hasEncryptedField) {
      const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
        workspaceId: (body.workspaceId || body.projectId || opts?.workspaceId) as string,
        agentId: (body.agentId || opts?.agentId) as string,
        mek: opts?.mek || (body.mek as string),
      });

      if (!mekBytes) {
        badRequest('Updating encrypted TOTP fields requires MEK header X-Kylrix-MEK, mek body property, or agentic workspace context');
      }

      const payloadToSeal: Record<string, any> = {};
      if (body.issuer !== undefined || body.name !== undefined) {
        payloadToSeal.issuer = String(body.issuer ?? body.name ?? '').trim();
      }
      if (body.accountName !== undefined) payloadToSeal.accountName = body.accountName == null ? null : String(body.accountName);
      if (body.secretKey !== undefined || body.secret !== undefined) {
        payloadToSeal.secretKey = String(body.secretKey ?? body.secret ?? '').trim();
      }
      if (body.url !== undefined) payloadToSeal.url = body.url == null ? null : String(body.url);

      const { encryptedFields, wrappedDek } = await sealRowFields(
        payloadToSeal,
        Object.keys(payloadToSeal),
        mekBytes,
        existing.dek
      );

      Object.assign(patch, encryptedFields);
      patch.dek = wrappedDek;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
      rowId: id,
      data: patch as any,
    });

    return this.getTotpSecret(actor, id, opts);
  },

  async deleteTotpSecret(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = createSystemTablesDB();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('TOTP secret not found');

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS || 'totpSecrets',
      rowId: id,
      data: {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'totp', id);

    return { id, deleted: true, trashed: true };
  },

  async listTrash(actor: ApiActor, limit = 50, opts?: { kind?: string | null }) {
    if (!actor.scopes.includes('trash:read') && !actor.scopes.includes('notes:read') && !actor.scopes.includes('vault:read')) {
      requireScope(actor, 'trash:read');
    }
    const tables = createSystemTablesDB();
    const targetKind = opts?.kind ? String(opts.kind).toLowerCase() : null;
    const items: any[] = [];
    const lim = Math.min(100, Math.max(1, limit));

    // 1. Trashed Notes
    if (!targetKind || targetKind === 'note' || targetKind === 'notes') {
      const notesRes = await tables.listRows({
        databaseId: DB,
        tableId: NOTES,
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of notesRes.rows) {
        items.push({
          id: r.$id,
          kind: 'note',
          title: r.title || 'Untitled note',
          summary: r.summary || (r.content ? String(r.content).slice(0, 140) : ''),
          updatedAt: r.$updatedAt || r.updatedAt || null,
          deletedAt: r.$updatedAt || r.updatedAt || null,
        });
      }
    }

    // 2. Trashed Goals / Tasks
    if (!targetKind || targetKind === 'goal' || targetKind === 'goals' || targetKind === 'task' || targetKind === 'tasks') {
      const tasksRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: TASKS,
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of tasksRes.rows) {
        items.push({
          id: r.$id,
          kind: 'goal',
          title: r.title || 'Untitled goal',
          status: r.status || 'trash',
          updatedAt: r.$updatedAt || r.updatedAt || null,
          deletedAt: r.$updatedAt || r.updatedAt || null,
        });
      }
    }

    // 3. Trashed Vault Credentials
    if (!targetKind || targetKind === 'vault' || targetKind === 'secret' || targetKind === 'credential' || targetKind === 'credentials') {
      const vaultRes = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of vaultRes.rows) {
        items.push({
          id: r.$id,
          kind: 'vault',
          title: r.name || 'Untitled secret',
          itemType: r.itemType || 'login',
          username: r.username || null,
          url: r.url || null,
          updatedAt: r.$updatedAt || r.updatedAt || null,
          deletedAt: r.$updatedAt || r.updatedAt || null,
        });
      }
    }

    // 4. Trashed Events
    if (!targetKind || targetKind === 'event' || targetKind === 'events') {
      const eventRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'events',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of eventRes.rows) {
        items.push({
          id: r.$id,
          kind: 'event',
          title: r.title || r.name || 'Untitled event',
          updatedAt: r.$updatedAt || r.updatedAt || null,
          deletedAt: r.$updatedAt || r.updatedAt || null,
        });
      }
    }

    // 5. Trashed Forms
    if (!targetKind || targetKind === 'form' || targetKind === 'forms') {
      const formRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'forms',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of formRes.rows) {
        items.push({
          id: r.$id,
          kind: 'form',
          title: r.title || r.name || 'Untitled form',
          updatedAt: r.$updatedAt || r.updatedAt || null,
          deletedAt: r.$updatedAt || r.updatedAt || null,
        });
      }
    }

    items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
    return items.slice(0, lim);
  },

  async restoreTrash(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('trash:write') && !actor.scopes.includes('notes:write') && !actor.scopes.includes('vault:write')) {
      requireScope(actor, 'trash:write');
    }
    const id = String(body.id || body.resourceId || '').trim();
    if (!id) badRequest('id required');
    const kind = String(body.kind || body.type || 'note').toLowerCase();
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();

    if (kind === 'vault' || kind === 'secret' || kind === 'credential') {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
        data: { isDeleted: false, updatedAt: now },
      });
      return { id, kind: 'vault', restored: true };
    }

    if (kind === 'note') {
      await tables.updateRow({
        databaseId: DB,
        tableId: NOTES,
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'note', restored: true };
    }

    if (kind === 'goal' || kind === 'task') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: TASKS,
        rowId: id,
        data: { isDeleted: false, isTrash: false, status: 'todo', updatedAt: now },
      });
      return { id, kind: 'goal', restored: true };
    }

    if (kind === 'event') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'events',
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'event', restored: true };
    }

    if (kind === 'form') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'forms',
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'form', restored: true };
    }

    badRequest(`Unknown trash kind: ${kind}`);
  },

  async purgeTrash(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'trash:write');
    const id = String(body.id || body.resourceId || '').trim();
    if (!id) badRequest('id required');
    const kind = String(body.kind || body.type || 'note').toLowerCase();
    const tables = createSystemTablesDB();

    if (kind === 'vault' || kind === 'secret' || kind === 'credential') {
      await tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      });
      return { id, kind: 'vault', purged: true };
    }

    if (kind === 'note') {
      await tables.deleteRow({ databaseId: DB, tableId: NOTES, rowId: id });
      return { id, kind: 'note', purged: true };
    }

    if (kind === 'goal' || kind === 'task') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id });
      return { id, kind: 'goal', purged: true };
    }

    if (kind === 'event') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id });
      return { id, kind: 'event', purged: true };
    }

    if (kind === 'form') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id });
      return { id, kind: 'form', purged: true };
    }

    badRequest(`Unknown trash kind: ${kind}`);
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

  async deriveAgentSovereignCrypto(customMnemonic?: string) {
    const bip39 = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english.js');
    const { HDKey } = await import('@scure/bip32');
    const secp256k1 = await import('@noble/secp256k1');
    const ed25519 = await import('@noble/ed25519');
    const { sha512 } = await import('@noble/hashes/sha2.js');
    const { base58, bech32 } = await import('@scure/base');
    const { keccak_256 } = await import('@noble/hashes/sha3.js');
    const { ripemd160: hash160 } = await import('@noble/hashes/legacy.js');
    const { blake2b } = await import('@noble/hashes/blake2.js');

    ed25519.hashes.sha512 = (message: Uint8Array) => sha512(message);
    ed25519.hashes.sha512Async = (message: Uint8Array) => Promise.resolve(sha512(message));

    const mnemonic = customMnemonic || bip39.generateMnemonic(wordlist, 128);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const rootKey = HDKey.fromMasterSeed(seed);

    // 1. EVM (m/44'/60'/0'/0/0)
    const evmChild = rootKey.derive("m/44'/60'/0'/0/0");
    if (!evmChild.privateKey) throw new Error('Failed to derive EVM key');
    const evmPub = secp256k1.getPublicKey(evmChild.privateKey, false).slice(1);
    const evmHash = keccak_256(evmPub);
    const ethAddress = '0x' + Array.from(evmHash.slice(-20)).map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();

    // 2. Solana (m/44'/501'/0'/0')
    const solChild = rootKey.derive("m/44'/501'/0'/0'");
    if (!solChild.privateKey) throw new Error('Failed to derive Solana key');
    const solPub = await ed25519.getPublicKey(solChild.privateKey);
    const solAddress = base58.encode(solPub);

    // 3. Bitcoin (m/84'/0'/0'/0/0 Native SegWit P2WPKH)
    const btcChild = rootKey.derive("m/84'/0'/0'/0/0");
    if (!btcChild.publicKey) throw new Error('Failed to derive Bitcoin key');
    const pkh = hash160(btcChild.publicKey);
    const btcWords = bech32.toWords(pkh);
    const btcAddress = bech32.encode('bc', [0, ...btcWords]);

    // 4. Sui (m/44'/784'/0'/0'/0')
    const suiChild = rootKey.derive("m/44'/784'/0'/0'/0'");
    if (!suiChild.privateKey) throw new Error('Failed to derive Sui key');
    const suiPub = await ed25519.getPublicKey(suiChild.privateKey);
    const tmp = new Uint8Array(33);
    tmp.set([0x00]);
    tmp.set(suiPub, 1);
    const suiHash = blake2b(tmp, { dkLen: 32 });
    const suiAddress = '0x' + Array.from(suiHash).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);

    // 5. Nostr keypair
    const nostrPriv = evmChild.privateKey;
    const nostrPubRaw = secp256k1.getPublicKey(nostrPriv, true).slice(1);
    const nostrPubkeyHex = Array.from(nostrPubRaw).map((b) => b.toString(16).padStart(2, '0')).join('');
    const nostrWords = bech32.toWords(nostrPubRaw);
    const nostrNpub = bech32.encode('npub', nostrWords);
    const nostrNsec = bech32.encode('nsec', bech32.toWords(nostrPriv));

    // 6. 32-byte MEK Hex
    const mekHex = Array.from(nostrPriv).map((b) => b.toString(16).padStart(2, '0')).join('');

    // 7. Multi-chain Wallet JSON map matching Kylrix standard
    const walletMap = {
      sol: solAddress,
      eth: ethAddress,
      btc: btcAddress,
      sui: suiAddress,
      base: ethAddress,
      polygon: ethAddress,
      arbitrum: ethAddress,
    };

    const walletAddressJson = JSON.stringify({
      sol: solAddress,
      eth: ethAddress,
      btc: btcAddress,
      sui: suiAddress,
    });

    return {
      mnemonic,
      walletAddressJson,
      walletMap,
      ethAddress,
      solAddress,
      btcAddress,
      suiAddress,
      nostrNpub,
      nostrNsec,
      nostrPubkeyHex,
      mekHex,
    };
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
      databaseId: DB,
      tableId: TAGS_TABLE,
      queries: [
        Query.equal('userId', actor.userId),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => {
      let color = r.color || null;
      let description = '';
      if (r.metadata) {
        try {
          const parsed = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
          if (parsed.color) color = parsed.color;
          if (parsed.description) description = parsed.description;
        } catch {}
      }
      return {
        id: r.$id,
        name: r.name || r.label || r.$id,
        color,
        description,
        usageCount: r.usageCount || 0,
      };
    });
  },

  async createTag(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'tags:write');
    const name = String(body.name || '').trim();
    if (!name) badRequest('Tag name is required');
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    const nameLower = name.toLowerCase();

    const existing = await tables
      .listRows({
        databaseId: DB,
        tableId: TAGS_TABLE,
        queries: [Query.equal('userId', actor.userId), Query.equal('nameLower', nameLower), Query.limit(1)],
      })
      .catch(() => ({ rows: [] as any[] }));

    if (existing.rows && existing.rows.length > 0) {
      const row = existing.rows[0];
      let color = row.color || null;
      let description = '';
      if (row.metadata) {
        try {
          const parsed = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          if (parsed.color) color = parsed.color;
          if (parsed.description) description = parsed.description;
        } catch {}
      }
      return {
        id: row.$id,
        name: row.name,
        color,
        description,
        usageCount: row.usageCount || 0,
      };
    }

    const color = typeof body.color === 'string' ? body.color : '#A855F7';
    const description = typeof body.description === 'string' ? body.description : '';
    const created = await tables.createRow({
      databaseId: DB,
      tableId: TAGS_TABLE,
      rowId: ID.unique(),
      data: {
        name,
        nameLower,
        userId: actor.userId,
        isPublic: !!body.isPublic,
        isGuest: !!body.isGuest,
        usageCount: 0,
        metadata: JSON.stringify({ color, description }),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
    });

    return {
      id: created.$id,
      name: created.name,
      color,
      description,
      usageCount: 0,
    };
  },

  async deleteTag(actor: ApiActor, id: string) {
    requireScope(actor, 'tags:write');
    const tables = createSystemTablesDB();
    await tables.deleteRow({
      databaseId: DB,
      tableId: TAGS_TABLE,
      rowId: id,
    });
    return { id, deleted: true };
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
