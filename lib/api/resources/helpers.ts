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
  looksEncrypted,
  VAULT_ENCRYPTED_FIELDS,
} from '@/lib/api/vault-crypto';
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
  shapeMoment,
  shapeMomentCommentCreated,
  shapeMomentCommentEcosystem,
  shapeMomentCommentNostr,
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
  shapeWorkspaceProject,
} from '@/sdk/contracts';
import {
  filterRootWorkspaceProjects,
  getParentProjectId,
  isSubProjectRecord,
  isWorkspaceRecord,
} from '@/lib/projects/sub-projects';
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';
import { assertActorFeatureAccess } from '@/lib/tools/gate';

export const DB = APPWRITE_CONFIG.DATABASES.NOTE;
export const NOTES = APPWRITE_CONFIG.TABLES.NOTE?.NOTES || APPWRITE_CONFIG.TABLES.NOTES;
export const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
export const TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
export const WORKFLOWS = 'workflows';

export function badRequest(message: string): never {
  const err = new Error(message);
  (err as any).status = 400;
  (err as any).code = 'bad_request';
  throw err;
}

export function notFound(message: string): never {
  const err = new Error(message);
  (err as any).status = 404;
  (err as any).code = 'not_found';
  throw err;
}

export function forbidden(message: string): never {
  const err = new Error(message);
  (err as any).status = 403;
  (err as any).code = 'forbidden';
  throw err;
}

export async function assertOwnedNote(tables: SystemTablesPort, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: DB, tableId: NOTES, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Note not found');
  return row;
}

export async function assertOwnedGoal(tables: SystemTablesPort, actor: ApiActor, id: string) {
  const row = (await tables
    .getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id })
    .catch(() => null)) as any;
  if (!row || row.userId !== actor.userId) notFound('Goal not found');
  return row;
}

export const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
export const PROJECT_OBJECTS = 'project_objects';

export async function linkObjectToWorkspace(
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
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(userId))],
    });
  } catch (err) {
    console.warn(`[ApiResources] Failed to link ${entityKind} ${entityId} to workspace ${projectId}:`, err);
    return null;
  }
}

export async function unlinkObjectFromWorkspace(
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

export const TAGS_TABLE = APPWRITE_CONFIG.TABLES.TAGS || APPWRITE_CONFIG.TABLES.NOTE.TAGS || '67ff06280034908cf08a';

export async function ensureTagsExist(
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

export async function getWorkspaceObjectIds(
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

export async function getAllLinkedWorkspaceObjectIds(
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
