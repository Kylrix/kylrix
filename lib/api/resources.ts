import { ID, Permission, Query, Role } from 'node-appwrite';
import { systemTables, type SystemTablesPort } from '@/lib/data';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { resolveParentRef } from '@/lib/api/v1/query';
import { listScopeCatalog, type PatScope } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
  cleanRowData,
  filterNoteData,
} from '@/lib/appwrite/note';
import { WorkflowDbService } from '@/lib/services/workflows';
import {
  generateRandomVaultSecret,
  parseMekToBytes,
  sealRowFields,
  unsealRowFields,
  unsealRowWithAnyKey,
  deriveMekFromMasterPassword,
  formatVaultSecretToEnv,
  looksEncrypted,
  VAULT_ENCRYPTED_FIELDS,
} from '@/lib/api/vault-crypto';
import {
  enforceWorkspaceJailing,
  getJailedWorkspaceId,
  isWorkspaceJailed,
  assertObjectInWorkspace,
  WorkspaceJailError,
} from '@/lib/workspaces/jailing';
import {
  shapeGoal,
  buildGoalCreateRow,
  buildGoalUpdatePatch,
  resolveWorkspaceId,
  shapeAgentSessionDetail,
  shapeAgentSessionListItem,
  shapeChatDetail,
  shapeChatListItem,
  shapeChatMessage,
  shapeEventDetail,
  shapeEventListItem,
  shapeFlowInstallListItem,
  shapeFlowListItem,
  resolveFlowCreateFields,
  shapeFormDetail,
  shapeFormListItem,
  shapeNote,
  shapeProfile,
  shapeTag,
  shapeTokenMe,
  shapeTokenRefreshResult,
  shapeTokenScopeCatalog,
  shapeTrashEventItem,
  shapeTrashFormItem,
  shapeTrashGoalItem,
  shapeTrashNoteItem,
  shapeTrashVaultItem,
  shapeVaultItem,
  shapeTotpSecret,
  shapeWorkspace,
  shapeWorkspaceCollaborator,
  shapeBillingCheckoutSession,
  shapeBillingStatus,
  shapeBillingCouponResult,
} from '@/sdk/contracts';
import {
  filterRootWorkspaceProjects,
  isWorkspaceRecord,
} from '@/lib/projects/sub-projects';
import { ownedWorkspaceListQueries } from '@/lib/projects/workspace-queries';
import { assertActorFeatureAccess } from '@/lib/tools/gate';

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

function forbidden(message: string): never {
  const err = new Error(message);
  (err as any).status = 403;
  (err as any).code = 'forbidden';
  throw err;
}

async function assertOwnedNote(tables: SystemTablesPort, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: DB, tableId: NOTES, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Note not found');
  await assertObjectInWorkspace(tables, actor, 'note', id, row);
  return row;
}

async function assertOwnedGoal(tables: SystemTablesPort, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Goal not found');
  await assertObjectInWorkspace(tables, actor, 'goal', id, row);
  return row;
}

const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECT_OBJECTS = 'project_objects';

async function linkObjectToWorkspace(
  tables: SystemTablesPort,
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
      permissions: [Permission.read(Role.user(userId))],
    });
  } catch (err) {
    console.warn(`[ApiResources] Failed to link ${entityKind} ${entityId} to workspace ${projectId}:`, err);
    return null;
  }
}

async function unlinkObjectFromWorkspace(
  tables: SystemTablesPort,
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
  tables: SystemTablesPort,
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
  tables: SystemTablesPort,
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
  tables: SystemTablesPort,
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

export async function resolveWorkspaceMekBytes(
  tables: any,
  actor: Partial<ApiActor>,
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
    let tier = 'FREE';
    let isPro = false;
    try {
      const { getVerifiedProEntitlementForUser } = await import('@/lib/services/internal/subscription-entitlement');
      const ent = await getVerifiedProEntitlementForUser(actor.userId).catch(() => null);
      if (ent) {
        tier = ent.uiTier;
        isPro = Boolean(ent.active);
      }
    } catch {
      // Non-fatal
    }
    return shapeProfile({
      ...actor,
      tier,
      quotas: {
        isPro,
        maxCollaboratorsPerResource: isPro ? 100 : 8,
        exportAllowed: true,
        aiRateLimitMultiplier: isPro ? 5 : 1,
      },
    });
  },

  async listNotes(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'notes:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal workspace access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const { isExcludedNote, ideaListExclusionQueries } = await import('@/lib/appwrite/note');

    if (wsId) {
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
    const tables = systemTables();
    const row = await assertOwnedNote(tables, actor, id);
    return shapeNote(row);
  },

  async createNote(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const title = clampNoteTitle(String(body?.title || '').trim() || 'Untitled', 'Untitled');
    const content = body?.content != null ? String(body.content) : '';
    const requestedWs = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal notes is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const now = new Date().toISOString();
    const noteId = ID.unique();

    const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const isGuest = body?.isGuest !== undefined ? Boolean(body.isGuest) : (body?.isPublic !== undefined ? Boolean(body.isPublic) : true);

    const cleanTags = await ensureTagsExist(tables, actor.userId, body?.tags as any[]);

    const permissions = wsId || isPublic || isGuest
      ? [
          Permission.read(Role.any()),
          Permission.update(Role.user(actor.userId)),
          Permission.delete(Role.user(actor.userId)),
        ]
      : [
          Permission.read(Role.user(actor.userId)),
          Permission.update(Role.user(actor.userId)),
          Permission.delete(Role.user(actor.userId)),
        ];

    const metadataObj: Record<string, unknown> = {
      isWorkspace: Boolean(wsId),
    };
    if (wsId) {
      metadataObj.projectId = wsId;
    }

    const note = await tables.createRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: noteId,
      data: {
        userId: actor.userId,
        title,
        content,
        format: 'markdown',
        isPublic,
        isGuest,
        metadata: JSON.stringify(metadataObj),
        tags: cleanTags,
        createdAt: now,
        updatedAt: now,
      },
      permissions,
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'note', noteId, actor.userId, { title });
    }

    return shapeNote(note);
  },

  async updateNote(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const requestedWs = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    enforceWorkspaceJailing(actor, requestedWs);
    const tables = systemTables();
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

    if (requestedWs) {
      await linkObjectToWorkspace(tables, requestedWs, 'note', id, actor.userId, {
        title: (patch.title as string) || (row as any).title,
      });
    }

    return shapeNote(row);
  },

  async deleteNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:write');
    const tables = systemTables();
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

  async listGoals(
    actor: ApiActor,
    limit = 25,
    opts?: { workspaceId?: string | null; status?: string | null },
  ) {
    requireScope(actor, 'goals:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal workspace access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const cap = Math.min(100, Math.max(1, limit));
    const statusFilter = opts?.status ? String(opts.status) : null;

    const applyFilters = (rows: ReturnType<typeof shapeGoal>[]) => {
      const filtered = statusFilter ? rows.filter((g) => g.status === statusFilter) : rows;
      return filtered.slice(0, cap);
    };

    if (wsId) {
      const goalIds = await getWorkspaceObjectIds(tables, wsId, 'goal');

      const seen = new Set<string>();
      const rows: ReturnType<typeof shapeGoal>[] = [];

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

      return applyFilters(rows);
    }

    // Personal workspace: strictly exclude items belonging to ANY real workspace
    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'goal');
    const queries = [
      Query.equal('userId', actor.userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(cap),
    ];
    if (statusFilter) queries.splice(1, 0, Query.equal('status', statusFilter));

    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: TASKS,
      queries,
    });
    return applyFilters(
      res.rows
        .filter((r: any) => !linkedIds.has(r.$id))
        .map(shapeGoal),
    );
  },

  async getGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:read');
    const tables = systemTables();
    const row = await assertOwnedGoal(tables, actor, id);
    return shapeGoal(row);
  },

  async createGoal(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'goals:write');
    const title = String(body?.title || '').trim();
    if (!title) badRequest('title required');
    const requestedWs = resolveWorkspaceId(body);
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal goals is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const goalId = ID.unique();

    const rowData = buildGoalCreateRow(actor.userId, body);
    if (wsId) {
      rowData.isWorkspace = true;
      rowData.projectId = wsId;
    }
    if (body?.tags !== undefined) {
      const cleanTags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
      if (cleanTags.length > 0) rowData.tags = cleanTags;
    }
    rowData.userId = actor.userId;

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: goalId,
      data: rowData as any,
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
    const requestedWs = resolveWorkspaceId(body);
    enforceWorkspaceJailing(actor, requestedWs);
    const tables = systemTables();
    await assertOwnedGoal(tables, actor, id);
    const patch = buildGoalUpdatePatch(body);
    if (requestedWs) {
      patch.isWorkspace = true;
      patch.projectId = requestedWs;
    }
    if (body.tags !== undefined) {
      patch.tags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
    }
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: id,
      data: patch as any,
    });

    if (requestedWs) {
      await linkObjectToWorkspace(tables, requestedWs, 'goal', id, actor.userId, {
        title: (patch.title as string) || (row as any).title,
      });
    }

    return shapeGoal(row);
  },

  async deleteGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:write');
    const tables = systemTables();
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
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: WORKFLOWS,
      queries: [
        Query.equal('ownerId', actor.userId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => shapeFlowListItem(r));
  },

  async createFlow(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'flows:write');
    let fields: ReturnType<typeof resolveFlowCreateFields>;
    try {
      fields = resolveFlowCreateFields(body);
    } catch {
      badRequest('name or title required');
    }
    const wf = {
      id: fields.id,
      name: fields.name,
      description: fields.description,
      niche: fields.niche as any,
      steps: fields.steps,
      isPublic: false,
      isAnonymized: false,
      createdAt: new Date().toISOString(),
    };
    await WorkflowDbService.saveWorkflow(wf, actor.userId);
    return await this.getFlow(actor, fields.id);
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
      return shapeTokenMe(actor);
    }
    const pat = await PatService.getOwned({ patId: actor.patId, userId: actor.userId });
    return shapeTokenMe(actor, { pat, catalog: listScopeCatalog() });
  },

  async tokenScopeCatalog(_actor: ApiActor) {
    return shapeTokenScopeCatalog(listScopeCatalog());
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

    if (actor.isAgent) {
      // Guardrail: Agents can self-grant workspace and agentic scopes, but cannot self-grant user private vault or PAT management
      const RESTRICTED_USER_SCOPES = new Set(['vault:read', 'vault:write', 'pats:write', 'admin:keys']);
      const requestedList: string[] = Array.isArray(scopes) ? scopes.map(String) : typeof scopes === 'string' ? [scopes] : [];
      for (const s of requestedList) {
        if (RESTRICTED_USER_SCOPES.has(s) && !actor.scopes.includes(s)) {
          badRequest(`Agentic tokens cannot self-grant restricted scope '${s}'. Manual authorization via owner agent provisioning key is required.`);
        }
      }
    }

    const pat = await PatService.updateScopes({
      patId: actor.patId!,
      userId: actor.userId,
      scopes,
      mode: body.mode === 'grant' || mode === 'grant' ? 'grant' : 'replace',
    });
    return shapeTokenRefreshResult(pat, 'New scopes apply on the next request with this same token (no re-mint).');
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
    const tables = systemTables();
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
          kind: 'workspace',
          parentProjectId: null,
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
    const jailedWs = getJailedWorkspaceId(actor);
    if (jailedWs) {
      const ws = await this.getWorkspace(actor, jailedWs);
      return [ws];
    }
    const tables = systemTables();
    
    // 1. Owned workspaces
    const ownedRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'projects',
      queries: [
        ...ownedWorkspaceListQueries(actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ] as any,
    });

    const ownedList = filterRootWorkspaceProjects(ownedRes.rows).map((r: any) =>
      shapeWorkspace(r, { isShared: false, role: 'owner' }),
    );

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
      if (ws && isWorkspaceRecord(ws)) {
        sharedList.push(
          shapeWorkspace(ws, { isShared: true, role: c.permission || 'writer' }),
        );
      }
    }

    return [...ownedList, ...sharedList];
  },

  async getWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:read');
    const jailedWs = getJailedWorkspaceId(actor);
    if (jailedWs && id !== jailedWs) {
      throw new WorkspaceJailError(
        `Actor is strictly jailed to workspace '${jailedWs}'. Access to workspace '${id}' is forbidden.`
      );
    }
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Workspace not found');
    if (!isWorkspaceRecord(row)) notFound('Workspace not found');

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

    return shapeWorkspace(row, { isShared: isCollab, role });
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

    const tables = systemTables();
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
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
      queries: [
        Query.equal('resourceId', workspaceId),
        Query.equal('resourceType', 'project'),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    return res.rows.map((r: any) => shapeWorkspaceCollaborator(r));
  },

  async listEvents(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'events:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal workspace access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();

    if (wsId) {
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
          rows.push(shapeEventListItem(row));
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
      .map((r: any) => shapeEventListItem(r));
  },

  async listForms(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'forms:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal workspace access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();

    if (wsId) {
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
          rows.push(shapeFormListItem(row));
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
      .map((r: any) => shapeFormListItem(r));
  },

  async listAgentSessions(actor: ApiActor, limit = 25, opts?: { harness?: string | null; workspaceId?: string | null }) {
    requireScope(actor, 'agents:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal workspace access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();

    if (wsId) {
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
          rows.push(shapeAgentSessionListItem(row));
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
      .map((r: any) => shapeAgentSessionListItem(r));
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
    const tables = systemTables();
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
    const tables = systemTables();
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
    const tables = systemTables();
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
    const tables = systemTables();
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
    return res.rows.map((r: any) => shapeChatListItem(r));
  },

  async getChat(actor: ApiActor, id: string) {
    requireScope(actor, 'chats:read');
    const tables = systemTables();
    const convTable =
      APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || 'conversations';
    const row = (await tables
      .getRow({ databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: convTable, rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Chat not found');
    const parts = Array.isArray(row.participants) ? row.participants : [];
    if (!parts.includes(actor.userId)) notFound('Chat not found');
    return shapeChatDetail(row);
  },

  async listChatMessages(actor: ApiActor, conversationId: string, limit = 50) {
    requireScope(actor, 'chats:read');
    const chat = await this.getChat(actor, conversationId);
    const tables = systemTables();
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
    return res.rows.map((r: any) => shapeChatMessage(r, chat.isEncrypted));
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
    const tables = systemTables();
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
    if (isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Jailed workspace actors cannot create new workspaces');
    }
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const now = new Date().toISOString();
    const tables = systemTables();
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
        kind: 'workspace',
        parentProjectId: null,
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
    return shapeWorkspace(row as Record<string, unknown>);
  },

  async updateWorkspace(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, id);
    const tables = systemTables();
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
    return shapeWorkspace(row as Record<string, unknown>);
  },

  async deleteWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:write');
    if (isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Jailed workspace actors cannot delete workspaces');
    }
    await this.getWorkspace(actor, id);
    const tables = systemTables();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id });
    return { id, deleted: true };
  },

  async listWorkspaceProjects(actor: ApiActor, workspaceId: string, _limit = 25) {
    requireScope(actor, 'workspaces:read');
    await assertActorFeatureAccess(actor.userId, 'projects');
    await this.getWorkspace(actor, workspaceId);
    const { verifyProjectPermission } = await import('@/lib/actions/secure-ops/shared');
    const canView = await verifyProjectPermission(workspaceId, actor.userId, 'viewer');
    if (!canView) forbidden('Insufficient permissions on workspace');

    return [];
  },

  async createWorkspaceProject(_actor: ApiActor, _workspaceId: string, _body: Record<string, unknown>) {
    badRequest('Sub-projects are no longer supported. Create a Workspace or Goal instead.');
  },

  async getWorkspaceProject(_actor: ApiActor, _workspaceId: string, _projectId: string) {
    notFound('Project not found');
  },

  async updateWorkspaceProject(
    _actor: ApiActor,
    _workspaceId: string,
    _projectId: string,
    _body: Record<string, unknown>,
  ) {
    notFound('Project not found');
  },

  async deleteWorkspaceProject(_actor: ApiActor, _workspaceId: string, _projectId: string) {
    notFound('Project not found');
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
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Event not found');
    await assertObjectInWorkspace(tables, actor, 'event', id, row);
    return shapeEventDetail(row);
  },

  async createEvent(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const requestedWs = (body.workspaceId || body.projectId || (body as any).wsId) as string | undefined;
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal events is forbidden for jailed workspace actors');
    }
    const startTime =
      body.startTime != null
        ? String(body.startTime)
        : new Date().toISOString();
    const endTime =
      body.endTime != null
        ? String(body.endTime)
        : new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
    const tables = systemTables();

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
        ...(wsId ? { isWorkspace: true } : {}),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'event', (row as any).$id, actor.userId, { title });
    }

    return this.getEvent(actor, (row as any).$id);
  },

  async updateEvent(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = systemTables();
    const patch: Record<string, unknown> = {};
    for (const k of ['title', 'description', 'startTime', 'endTime', 'location', 'status', 'visibility'] as const) {
      if (body[k] !== undefined) patch[k] = body[k] == null ? null : String(body[k]);
    }
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    const targetWs = (body.workspaceId || body.projectId) as string | undefined;
    if (targetWs) {
      patch.isWorkspace = true;
      patch.projectId = targetWs;
    }
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id, data: patch as any });
    if (targetWs) {
      await linkObjectToWorkspace(tables, targetWs, 'event', id, actor.userId, {
        title: (patch.title as string) || 'Event',
      });
    }
    return this.getEvent(actor, id);
  },

  async deleteEvent(actor: ApiActor, id: string) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = systemTables();
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
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.isDeleted) notFound('Form not found');
    const isPublic = row.isPublic === true || row.isGuest === true || row.status === 'published';
    if (row.userId !== actor.userId && !isPublic) notFound('Form not found');
    await assertObjectInWorkspace(tables, actor, 'form', id, row);
    return shapeFormDetail(row);
  },

  async createForm(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const requestedWs = (body.workspaceId || body.projectId || (body as any).wsId) as string | undefined;
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal forms is forbidden for jailed workspace actors');
    }
    const tables = systemTables();

    let schemaStr = '[]';
    if (body.schema != null) {
      schemaStr = typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema);
    } else if (body.fields != null) {
      schemaStr = typeof body.fields === 'string' ? body.fields : JSON.stringify(body.fields);
    }

    let settingsStr: string | null = null;
    if (body.settings != null) {
      settingsStr = typeof body.settings === 'string' ? body.settings : JSON.stringify(body.settings);
    } else if (body.ghostFields != null) {
      settingsStr = JSON.stringify({ ghostFields: body.ghostFields });
    }

    const isPublic = body.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const isGuest = body.isGuest !== undefined ? Boolean(body.isGuest) : true;

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'forms',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body.description != null ? String(body.description) : '',
        schema: schemaStr,
        settings: settingsStr,
        userId: actor.userId,
        status: String(body.status || 'published'),
        visibility: String(body.visibility || (isPublic ? 'public' : 'private')),
        isPublic,
        isGuest,
        isPinned: !!body.isPinned,
        isTrash: false,
        ...(wsId ? { isWorkspace: true } : {}),
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        ...(isPublic ? [Permission.read(Role.any())] : []),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'form', (row as any).$id, actor.userId, { title });
    }

    return this.getForm(actor, (row as any).$id);
  },

  async updateForm(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = systemTables();
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.schema !== undefined) {
      patch.schema = typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema);
    } else if (body.fields !== undefined) {
      patch.schema = typeof body.fields === 'string' ? body.fields : JSON.stringify(body.fields);
    }
    if (body.settings !== undefined) {
      patch.settings = typeof body.settings === 'string' ? body.settings : JSON.stringify(body.settings);
    } else if (body.ghostFields !== undefined) {
      patch.settings = JSON.stringify({ ghostFields: body.ghostFields });
    }
    if (body.status !== undefined) patch.status = String(body.status);
    if (body.visibility !== undefined) patch.visibility = String(body.visibility);
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    if (body.isGuest !== undefined) patch.isGuest = !!body.isGuest;
    if (body.isPinned !== undefined) patch.isPinned = !!body.isPinned;
    const targetWs = (body.workspaceId || body.projectId) as string | undefined;
    if (targetWs) {
      patch.isWorkspace = true;
    }
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id, data: patch as any });
    if (targetWs) {
      await linkObjectToWorkspace(tables, targetWs, 'form', id, actor.userId, {
        title: (patch.title as string) || 'Form',
      });
    }
    return this.getForm(actor, id);
  },

  async deleteForm(actor: ApiActor, id: string) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = systemTables();
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

  async installFlow(actor: ApiActor, flowId: string, body: Record<string, unknown> = {}) {
    requireScope(actor, 'flows:install');
    const id = String(flowId || body.flowId || body.id || '').trim();
    if (!id) badRequest('flow id required in URL path');
    const { FlowInstallService } = await import('@/lib/services/flow-installs');
    const result = await FlowInstallService.install({
      flowId: id,
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
    return rows.map((r: any) => shapeFlowInstallListItem(r));
  },

  async listVaultItems(
    actor: ApiActor,
    limit = 25,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal vault access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, { ...opts, workspaceId: wsId });
    const lim = Math.min(100, Math.max(1, limit));

    let rows: any[] = [];

    if (wsId) {
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

        return shapeVaultItem(r, {
          unsealed,
          hasMek: !!mekBytes,
          looksEncrypted,
        });
      }),
    );
  },

  async getVaultItem(
    actor: ApiActor,
    id: string,
    opts?: {
      mek?: string | null;
      shareKey?: string | null;
      masterPassword?: string | null;
      workspaceId?: string | null;
      agentId?: string | null;
      format?: string | null;
      pure?: boolean;
    }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || (r.userId !== actor.userId && !r.isPublic && !r.isGuest) || r.isDeleted) {
      notFound('Vault item not found');
    }
    if (r.userId === actor.userId) {
      await assertObjectInWorkspace(tables, actor, 'credential', id, r);
    }

    let mekBytes: Uint8Array | null = null;
    if (opts?.masterPassword) {
      try {
        const kcRes = await tables.listRows({
          databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
          tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN || 'keychain',
          queries: [Query.equal('userId', actor.userId), Query.limit(1)],
        });
        const kc = kcRes.rows?.[0];
        if (kc) {
          mekBytes = await deriveMekFromMasterPassword({
            password: opts.masterPassword,
            salt: kc.salt,
            wrappedKey: kc.wrappedKey,
            params: kc.params,
            isArgon: kc.isArgon,
          });
        }
      } catch {}
    }

    if (!mekBytes) {
      mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    }

    const { unsealed, keyUsed } = await unsealRowWithAnyKey(
      r,
      VAULT_ENCRYPTED_FIELDS.credentials,
      {
        shareKey: opts?.shareKey,
        mek: opts?.mek,
        mekBytes,
      }
    );

    const shaped = shapeVaultItem(r, {
      unsealed,
      hasMek: !!keyUsed || !!mekBytes,
      looksEncrypted,
    });

    const envText = formatVaultSecretToEnv(unsealed, { pure: opts?.pure, fallbackTitle: r.name });

    if (opts?.format === 'env' || opts?.format === 'dotenv') {
      return {
        ...shaped,
        format: 'env',
        envText,
        keyUsed,
      };
    }

    return {
      ...shaped,
      envText: envText || null,
      keyUsed,
    };
  },

  async getPublicVaultItem(
    idOrShareUrl: string,
    opts?: {
      shareKey?: string | null;
      format?: string | null;
      pure?: boolean;
    }
  ) {
    const tables = systemTables();
    let cleanId = idOrShareUrl.trim();
    let extractedKey = opts?.shareKey || null;

    // Parse full share URL or id#key / id/key formats
    if (cleanId.includes('/vault/')) {
      const parts = cleanId.split('/vault/')[1].split(/[#\/?]/);
      cleanId = parts[0];
      if (parts[1] && !extractedKey) {
        extractedKey = parts[1];
      }
    } else if (cleanId.includes('#')) {
      const [id, key] = cleanId.split('#');
      cleanId = id;
      if (key && !extractedKey) extractedKey = key;
    } else if (cleanId.includes('/') && !cleanId.startsWith('http')) {
      const [id, key] = cleanId.split('/');
      cleanId = id;
      if (key && !extractedKey) extractedKey = key;
    }

    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: cleanId,
      })
      .catch(() => null)) as any;

    if (!r || r.isDeleted || (!r.isPublic && !r.isGuest)) {
      notFound('Public secret not found or is not shared publicly');
    }

    const { unsealed, keyUsed } = await unsealRowWithAnyKey(
      r,
      VAULT_ENCRYPTED_FIELDS.credentials,
      { shareKey: extractedKey }
    );

    const shaped = shapeVaultItem(r, {
      unsealed,
      hasMek: !!keyUsed,
      looksEncrypted,
    });

    const envText = formatVaultSecretToEnv(unsealed, { pure: opts?.pure, fallbackTitle: r.name });

    if (opts?.format === 'env' || opts?.format === 'dotenv') {
      return {
        ...shaped,
        format: 'env',
        envText,
        keyUsed,
      };
    }

    return {
      ...shaped,
      envText: envText || null,
      keyUsed,
      isPublic: true,
    };
  },

  async unlockUserMek(
    actor: ApiActor,
    opts?: { masterPassword?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const kcRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN || 'keychain',
      queries: [Query.equal('userId', actor.userId), Query.limit(1)],
    });
    const kc = kcRes.rows?.[0];
    if (!kc) {
      notFound('Keychain entry not found for user');
    }

    if (!opts?.masterPassword) {
      // Light lifting default: return raw encrypted keychain blob
      return {
        success: true,
        unlocked: false,
        keychain: {
          wrappedKey: kc.wrappedKey,
          salt: kc.salt,
          params: kc.params,
          isArgon: !!kc.isArgon,
        },
      };
    }

    // Heavy lifting: derive and decrypt MEK on server
    const mekBytes = await deriveMekFromMasterPassword({
      password: opts.masterPassword,
      salt: kc.salt,
      wrappedKey: kc.wrappedKey,
      params: kc.params,
      isArgon: kc.isArgon,
    });

    if (!mekBytes) {
      const err = new Error('Invalid master password');
      (err as any).status = 401;
      (err as any).code = 'invalid_master_password';
      throw err;
    }

    return {
      success: true,
      unlocked: true,
      mekHex: Buffer.from(mekBytes).toString('hex'),
      mekBase64: Buffer.from(mekBytes).toString('base64'),
      isArgon: !!kc.isArgon,
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

    const tables = systemTables();
    const requestedWs = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal credentials is forbidden for jailed workspace actors');
    }
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

    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

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
        isEnv: body.isEnv === true,
        tags,
        ...(wsId ? { isWorkspace: true } : {}),
        createdAt: now,
        updatedAt: now,
      },
      permissions: wsId
        ? [
            Permission.read(Role.any()),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ]
        : [
            Permission.read(Role.user(actor.userId)),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'credential', itemId, actor.userId, { title: name });
      await linkObjectToWorkspace(tables, wsId, 'secret', itemId, actor.userId, { title: name });
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
      tags,
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
    const tables = systemTables();
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
    if (body.isEnv !== undefined) patch.isEnv = !!body.isEnv;
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

    const targetWs = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    if (targetWs) {
      patch.isWorkspace = true;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: id,
      data: patch as any,
    });

    if (targetWs) {
      await linkObjectToWorkspace(tables, targetWs, 'credential', id, actor.userId, {
        title: (body.name as string) || (existing.name as string),
      });
      await linkObjectToWorkspace(tables, targetWs, 'secret', id, actor.userId, {
        title: (body.name as string) || (existing.name as string),
      });
    }

    return this.getVaultItem(actor, id, opts);
  },

  async deleteVaultItem(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
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
    const wsId = enforceWorkspaceJailing(actor, opts?.workspaceId);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Personal TOTP access is forbidden for jailed workspace actors');
    }
    const tables = systemTables();
    const lim = Math.min(100, Math.max(1, limit));
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, { ...opts, workspaceId: wsId });

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
            tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
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
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
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

        return shapeTotpSecret(r, {
          unsealed,
          hasMek: !!mekBytes,
          looksEncrypted,
        });
      }),
    );
  },

  async getTotpSecret(
    actor: ApiActor,
    id: string,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || r.userId !== actor.userId || r.isDeleted) notFound('TOTP secret not found');
    await assertObjectInWorkspace(tables, actor, 'totp', id, r);

    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const unsealed = mekBytes
      ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.totpSecrets, mekBytes)
      : {};

    return shapeTotpSecret(r, {
      unsealed,
      hasMek: !!mekBytes,
      looksEncrypted,
    });
  },

  async createTotpSecret(
    actor: ApiActor,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const secretKey = String(body.secretKey || body.secret || '').trim();
    if (!secretKey) badRequest('secretKey required');

    const tables = systemTables();
    const requestedWs = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const wsId = enforceWorkspaceJailing(actor, requestedWs);
    if (!wsId && isWorkspaceJailed(actor)) {
      throw new WorkspaceJailError('Creating personal TOTP secrets is forbidden for jailed workspace actors');
    }
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

    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    const itemId = ID.unique();
    const now = new Date().toISOString();

    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
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
        tags,
        ...(wsId ? { isWorkspace: true } : {}),
        createdAt: now,
        updatedAt: now,
      },
      permissions: wsId
        ? [
            Permission.read(Role.any()),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ]
        : [
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
      tags,
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
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
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

    const targetWs = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    if (targetWs) {
      patch.isWorkspace = true;
      patch.projectId = targetWs;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
      rowId: id,
      data: patch as any,
    });

    if (targetWs) {
      await linkObjectToWorkspace(tables, targetWs, 'totp', id, actor.userId, {
        title: (body.issuer || existing.issuer) as string,
      });
    }

    return this.getTotpSecret(actor, id, opts);
  },

  async deleteTotpSecret(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('TOTP secret not found');

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
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
    const tables = systemTables();
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
        items.push(shapeTrashNoteItem(r));
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
        items.push(shapeTrashGoalItem(r));
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
        items.push(shapeTrashVaultItem(r));
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
        items.push(shapeTrashEventItem(r));
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
        items.push(shapeTrashFormItem(r));
      }
    }

    items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
    const jailedWs = getJailedWorkspaceId(actor);
    if (jailedWs) {
      const filteredItems: any[] = [];
      for (const item of items) {
        try {
          await assertObjectInWorkspace(tables, actor, item.kind || 'note', item.id);
          filteredItems.push(item);
        } catch {}
      }
      return filteredItems.slice(0, lim);
    }
    return items.slice(0, lim);
  },

  async restoreTrash(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('trash:write') && !actor.scopes.includes('notes:write') && !actor.scopes.includes('vault:write')) {
      requireScope(actor, 'trash:write');
    }
    const id = String(body.id || body.resourceId || '').trim();
    if (!id) badRequest('id required');
    const kind = String(body.kind || body.type || 'note').toLowerCase();
    const tables = systemTables();
    await assertObjectInWorkspace(tables, actor, kind, id);
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
    const tables = systemTables();
    await assertObjectInWorkspace(tables, actor, kind, id);

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
    const { parentKind, parentId } = resolveParentRef(body);
    if (!parentKind || !parentId) badRequest('parent_kind and parent_id required');
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
    const tables = systemTables();
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
    await assertOwnedNote(systemTables(), actor, noteId);
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
    await assertOwnedGoal(systemTables(), actor, goalId);
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
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: TAGS_TABLE,
      queries: [
        Query.equal('userId', actor.userId),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => shapeTag(r));
  },

  async createTag(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'tags:write');
    const name = String(body.name || '').trim();
    if (!name) badRequest('Tag name is required');
    const tables = systemTables();
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
      return shapeTag(existing.rows[0]);
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

    return shapeTag(created);
  },

  async deleteTag(actor: ApiActor, id: string) {
    if (actor.isAgent || actor.category === 'agentic_pat') {
      forbidden('Autonomous agents cannot delete user tags. Tag deletion requires human owner authorization.');
    }
    requireScope(actor, 'tags:write');
    const tables = systemTables();
    await tables.deleteRow({
      databaseId: DB,
      tableId: TAGS_TABLE,
      rowId: id,
    });
    return { id, deleted: true };
  },

  async listObjects(actor: ApiActor, limit = 50) {
    requireScope(actor, 'objects:read');
    const tables = systemTables();
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
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Session not found');
    await assertObjectInWorkspace(tables, actor, 'agent_session', id, row);
    if (row.harness) requireScope(actor, 'agents:harness');
    return shapeAgentSessionDetail(row);
  },

  async deleteAgentSession(actor: ApiActor, id: string) {
    requireScope(actor, 'agents:write');
    await this.getAgentSession(actor, id);
    const tables = systemTables();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: id });
    return { id, deleted: true };
  },

  async syncHandshake(actor: ApiActor) {
    const { isSelfHostedDeployment, isKylrixCloud } = await import('@/lib/deployment/surface');
    const tables = systemTables();
    let keychainCount = 0;
    try {
      const res = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
        queries: [Query.equal('userId', actor.userId), Query.limit(20)],
      });
      keychainCount = res.rows.length;
    } catch {
      keychainCount = 0;
    }

    return {
      node: {
        isCloud: !isSelfHostedDeployment() || isKylrixCloud(),
        isSelfHosted: isSelfHostedDeployment(),
        isKylrixCloud: isKylrixCloud(),
        nodeVersion: '1.0.0',
        capabilities: ['account_sync', 'keychain_sync', 'notes_sync', 'goals_sync'],
      },
      account: {
        userId: actor.userId,
        hasKeychain: keychainCount > 0,
        keychainCount,
      },
    };
  },

  async syncAccount(actor: ApiActor, body: Record<string, unknown>) {
    const { createSystemClient, createSystemTablesDB } = await import('@/lib/appwrite-admin');
    const { isSelfHostedDeployment, isKylrixCloud } = await import('@/lib/deployment/surface');

    const accountObj = (body.account || {}) as Record<string, any>;
    const targetEmail = String(accountObj.email || body.email || '').trim().toLowerCase();
    const sourceUserId = String(accountObj.userId || body.userId || actor.userId).trim();
    const sourceName = String(accountObj.name || body.name || '').trim();

    const keychainEntries = Array.isArray(body.keychain)
      ? body.keychain
      : Array.isArray(accountObj.keychain)
      ? accountObj.keychain
      : [];

    const sysClient = createSystemClient();
    const sysUsers = sysClient.users;
    const sysTables: any = createSystemTablesDB();

    let targetUserId = actor.userId;
    let replicatedAccount = false;

    // Failsafe 1: Look up user on Cloud target by email first to prevent duplicate user creation errors in Appwrite
    if (targetEmail) {
      const existingByEmail = await sysUsers.list([Query.equal('email', targetEmail), Query.limit(1)]).catch(() => ({ total: 0, users: [] }));
      if (existingByEmail.total > 0 && existingByEmail.users[0]) {
        targetUserId = existingByEmail.users[0].$id;
      } else {
        // Look up by sourceUserId
        const existingById = await sysUsers.get(sourceUserId).catch(() => null);
        if (existingById) {
          targetUserId = existingById.$id;
        } else {
          // Create new user account on Cloud via Server SDK
          try {
            const newUser = await sysUsers.create(
              sourceUserId || ID.unique(),
              targetEmail,
              undefined,
              undefined,
              sourceName || targetEmail.split('@')[0]
            );
            targetUserId = newUser.$id;
            replicatedAccount = true;
          } catch (err: any) {
            console.warn('[syncAccount] Failed to replicate user, falling back to actor.userId:', err?.message);
            targetUserId = actor.userId;
          }
        }
      }
    }

    // Master Keychain & Encryption System Replication
    let replicatedKeychain = false;
    let syncedKeychainCount = 0;

    if (keychainEntries.length > 0) {
      const now = new Date().toISOString();

      const existingKeychain = await sysTables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
        queries: [Query.equal('userId', targetUserId), Query.limit(20)],
      }).catch(() => ({ rows: [] }));

      const existingMap = new Map<string, any>();
      for (const r of existingKeychain.rows || []) {
        if (r.type) existingMap.set(r.type, r);
      }

      for (const entry of keychainEntries) {
        if (!entry.wrappedKey || !entry.salt) continue;
        const entryType = String(entry.type || 'password');
        const existingRow = existingMap.get(entryType);

        if (!existingRow) {
          await sysTables.createRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
            rowId: ID.unique(),
            data: {
              userId: targetUserId,
              type: entryType,
              authPass: entry.authPass ?? true,
              wrappedKey: String(entry.wrappedKey),
              salt: String(entry.salt),
              params: typeof entry.params === 'string' ? entry.params : JSON.stringify(entry.params || { algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 }),
              isArgon: entry.isArgon ?? true,
              isPending: false,
              createdAt: now,
              updatedAt: now,
            },
            permissions: [
              Permission.read(Role.user(targetUserId)),
              Permission.update(Role.user(targetUserId)),
              Permission.delete(Role.user(targetUserId)),
            ],
          }).catch((e: any) => console.warn('[syncAccount] Keychain row create warn:', e?.message));
          replicatedKeychain = true;
          syncedKeychainCount++;
        } else {
          if (existingRow.wrappedKey !== entry.wrappedKey || existingRow.salt !== entry.salt) {
            await sysTables.updateRow({
              databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
              tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
              rowId: existingRow.$id,
              data: {
                wrappedKey: String(entry.wrappedKey),
                salt: String(entry.salt),
                authPass: entry.authPass ?? true,
                params: typeof entry.params === 'string' ? entry.params : JSON.stringify(entry.params || { algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 }),
                isArgon: entry.isArgon ?? true,
                updatedAt: now,
              },
            }).catch((e: any) => console.warn('[syncAccount] Keychain row update warn:', e?.message));
            replicatedKeychain = true;
          }
          syncedKeychainCount++;
        }
      }
    }

    return {
      success: true,
      targetUserId,
      email: targetEmail || undefined,
      replicatedAccount,
      replicatedKeychain,
      syncedKeychainCount,
      node: {
        isCloud: !isSelfHostedDeployment() || isKylrixCloud(),
        isSelfHosted: isSelfHostedDeployment(),
      },
    };
  },

  async createBillingCheckout(
    actor: ApiActor,
    input: {
      planId?: string;
      months?: number;
      ticker?: string;
      coin?: string;
      couponId?: string;
    },
  ) {
    requireScope(actor, 'billing:write');
    const planId = String(input.planId || 'PRO_MONTH').trim();
    const months = Number.isInteger(input.months) && (input.months as number) > 0 ? (input.months as number) : 1;
    const ticker = input.ticker || input.coin;
    const couponId = input.couponId ? String(input.couponId).trim() : undefined;

    const { createSystemClient } = await import('@/lib/appwrite-admin');
    const { calculateSubscriptionPrice } = await import('@/lib/subscription/ppp');
    const { BlockBeeBillingAdapter } = await import('@/lib/billing/providers/blockbee');
    const { resolveBillingNotifyUrl, resolveBillingSuccessUrl } = await import('@/lib/billing/callback-urls');
    const { registerPendingCheckoutWithAdapter } = await import('@/lib/billing/pending-checkout');

    const expectedAmountUsd = calculateSubscriptionPrice(planId, 'US', 'CRYPTO', months);
    const blockbee = new BlockBeeBillingAdapter();

    if (ticker) {
      // Direct Crypto Address Generation for CLI / autonomous agent payments
      const notifyUrl = `${resolveBillingNotifyUrl()}?plan_id=${encodeURIComponent(planId)}&months=${months}&order_id=direct_${actor.userId}_${Date.now()}`;
      const direct = await blockbee.createDirectCryptoAddress(ticker, {
        planId,
        userId: actor.userId,
        countryCode: 'US',
        months,
        amountUsd: expectedAmountUsd,
        notifyUrl,
        redirectUrl: resolveBillingSuccessUrl(),
      });

      // Register pending checkout
      await registerPendingCheckoutWithAdapter({
        paymentId: direct.paymentId,
        providerAdapterId: 'blockbee',
        payerUserId: actor.userId,
        planId,
        months,
        countryCode: 'US',
        expectedAmountUsd,
        couponId,
      }).catch((err) => console.warn('[createBillingCheckout] Registry warn:', err));

      // Record in billing_transactions
      const { databases } = createSystemClient();
      await databases.createRow(
        APPWRITE_CONFIG.DATABASES.NOTE,
        'billing_transactions',
        ID.unique(),
        {
          paymentId: direct.paymentId,
          userId: actor.userId,
          plan: planId,
          months,
          amountCents: Math.round(expectedAmountUsd * 100),
          amountUsd: `$${expectedAmountUsd.toFixed(2)}`,
          status: 'pending',
          provider: 'blockbee',
          couponId: couponId || null,
          metadata: JSON.stringify({
            coin: direct.coin,
            addressIn: direct.addressIn,
            qrCode: direct.qrCode,
            paymentUri: direct.paymentUri,
            createdAt: new Date().toISOString(),
          }),
        },
        [Permission.read(Role.user(actor.userId))]
      ).catch((err: any) => console.warn('[createBillingCheckout] Transaction log warn:', err));

      return shapeBillingCheckoutSession({
        id: direct.paymentId,
        url: resolveBillingSuccessUrl(),
        planId,
        amountUsd: expectedAmountUsd,
        status: 'pending',
        addressIn: direct.addressIn,
        qrCode: direct.qrCode,
        paymentUri: direct.paymentUri,
        minimumTransactionCoin: direct.minimumTransactionCoin,
        coin: direct.coin,
      });
    }

    // Hosted Checkout URL Flow
    const { createBillingCheckoutSessionAction } = await import('@/lib/actions/billing/billing');
    const session = await createBillingCheckoutSessionAction({
      planId,
      method: 'CRYPTO',
      months,
      couponId,
      jwt: undefined,
    });

    return shapeBillingCheckoutSession({
      id: session.id,
      url: session.url,
      planId,
      amountUsd: expectedAmountUsd,
      status: 'pending',
    });
  },

  async getBillingStatus(actor: ApiActor) {
    requireScope(actor, 'billing:read');
    const { getVerifiedProEntitlementForUser } = await import('@/lib/services/internal/subscription-entitlement');
    const { InternalKylrixTokenService } = await import('@/lib/services/internal/kylrix-token');
    const { createSystemClient } = await import('@/lib/appwrite-admin');

    const [entitlement, balance, txList] = await Promise.all([
      getVerifiedProEntitlementForUser(actor.userId).catch(() => ({
        active: false,
        expiresAt: null,
        source: 'none' as const,
        uiTier: 'FREE' as const,
      })),
      InternalKylrixTokenService.getUserBalance(actor.userId).then((b: any) => ({
        amount: typeof b?.amount === 'number' ? b.amount : parseFloat(b?.amount || '0') || 0,
        symbol: String(b?.symbol || 'KYL'),
      })).catch(() => ({
        amount: 0,
        symbol: 'KYL',
      })),
      (async () => {
        try {
          const { databases } = createSystemClient();
          const list = await databases.listRows(APPWRITE_CONFIG.DATABASES.NOTE, 'billing_transactions', [
            Query.equal('userId', actor.userId),
            Query.orderDesc('$createdAt'),
            Query.limit(20),
          ]);
          return list.rows;
        } catch {
          return [];
        }
      })(),
    ]);

    return shapeBillingStatus({
      userId: actor.userId,
      active: entitlement.active,
      tier: entitlement.uiTier,
      expiresAt: entitlement.expiresAt,
      source: entitlement.source,
      balance,
      transactions: txList,
    });
  },

  async listSupportedBillingCoins(_actor: ApiActor) {
    const { BlockBeeBillingAdapter } = await import('@/lib/billing/providers/blockbee');
    const blockbee = new BlockBeeBillingAdapter();
    return {
      coins: blockbee.getSupportedCoins(),
    };
  },

  async claimBillingCoupon(actor: ApiActor, input: { couponId: string }) {
    requireScope(actor, 'billing:write');
    const couponId = String(input.couponId || '').trim();
    if (!couponId) badRequest('couponId is required');

    const { claimCouponAction } = await import('@/lib/actions/billing/billing');
    const res = await claimCouponAction(couponId);
    return shapeBillingCouponResult(res as any);
  },
};
