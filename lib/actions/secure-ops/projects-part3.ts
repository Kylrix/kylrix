'use server';

import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import {
  allowsCollaboratorSharing,
  getProjectCap
} from '@/lib/entitlements';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { provisionHybridTeamExpansionSecure } from '@/lib/api/permission-updater';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import {
  ProjectSchema
} from '@/lib/validations/schemas';
import { filterRootWorkspaceProjects, isWorkspaceRecord } from '@/lib/projects/sub-projects';
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';

// Import interfaces / types from shared

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  verifyResourcePermissionSecure,
  verifyProjectPermission,
  verifyFormPermission,
  verifyEventPermission,
  sanitizeEventData,
  rowCache} = shared;

export async function deleteGoalSecure(goalId: string, jwt?: string): Promise<void> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  try {
    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      rowId: goalId,
      data: { isTrash: true, isDeleted: true },
    });
  } catch (_err: any) {
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      rowId: goalId,
    }).catch(() => {});
  }
}

export async function resolveWorkspaceShareAccessSecure(workspaceId: string, jwt?: string) {
  const actor = await getActor(jwt).catch(() => null);
  const tables = createSystemTablesDB();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = 'projects';

  const row = await tables.getRow({
    databaseId: dbId,
    tableId,
    rowId: workspaceId,
  }).catch(() => null);

  if (!row) {
    return {
      success: false,
      reason: 'not_found' as const,
      message: 'Workspace does not exist or has been deleted.',
    };
  }

  const ownerId = row.ownerId || row.userId || 'unknown';
  const title = row.title || row.name || 'Shared Workspace';
  const isPublic = row.isPublic === true || row.isGuest === true;

  const isAgentic = row.isAgentic === true || String(row.isAgentic) === 'true';
  const agentId = row.agentId || null;

  // 1. Lazy check: If workspace is public, return access immediately!
  if (isPublic) {
    return {
      success: true,
      workspace: {
        id: row.$id,
        title,
        ownerId,
        isPublic: true,
        isAgentic,
        agentId,
        isOwner: actor?.$id ? actor.$id === ownerId : false,
      },
    };
  }

  // 2. If private, check if current actor is the owner
  if (actor?.$id && actor.$id === ownerId) {
    return {
      success: true,
      workspace: {
        id: row.$id,
        title,
        ownerId,
        isPublic: false,
        isAgentic,
        agentId,
        isOwner: true,
      },
    };
  }

  // 3. If private and actor is logged in, check if actor is a collaborator
  if (actor?.$id) {
    const hasAccess = await verifyProjectPermission(workspaceId, actor.$id, 'viewer').catch(() => false);
    if (hasAccess) {
      return {
        success: true,
        workspace: {
          id: row.$id,
          title,
          ownerId,
          isPublic: false,
          isAgentic,
          agentId,
          isCollaborator: true,
        },
      };
    }
  }

  // 4. Inaccessible (private and not a collaborator / unauthenticated):
  let ownerName = 'the workspace owner';
  if (row.ownerName) {
    ownerName = row.ownerName;
  } else if (ownerId && ownerId !== 'unknown') {
    try {
      const { UsersService } = await import('@/lib/services/users');
      const profile = await UsersService.getProfileById(ownerId).catch(() => null);
      if (profile?.displayName || profile?.username) {
        ownerName = profile.displayName || `@${profile.username}`;
      }
    } catch {}
  }

  return {
    success: false,
    reason: 'forbidden' as const,
    ownerName,
    message: `No access to workspace. Ask ${ownerName} to make public or add you to collaborators.`,
  };
}

/**
 * Resolves all entities belonging to a shared workspace across the 7 supported entity kinds:
 * 1. note (ideas/notes)
 * 2. goal (tasks/goals)
 * 3. form (forms)
 * 4. event (events)
 * 5. credential (vault secrets/passwords)
 * 6. totp (vault 2FA secrets)
 * 7. agent_session (Kylie / Sidekick agentic sessions)
 * 
 * Uses privileged Server SDK after verifying workspace accessibility (public/collaborator).
 */
export async function getSharedWorkspaceEntitiesSecure(
  workspaceId: string,
  entityKind: string,
  jwt?: string,
): Promise<{ success: boolean; rows: any[]; message?: string; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, rows: [], message: 'Workspace ID required' };
    }

    const access = await resolveWorkspaceShareAccessSecure(workspaceId, jwt);
    if (!access.success) {
      return { success: false, rows: [], message: access.message || 'No access to workspace' };
    }

    const tables = createSystemTablesDB();
    const dbId = APPWRITE_CONFIG.DATABASES.CHAT;

    let normKind = entityKind.toLowerCase().trim();
    if (normKind === 'ideas' || normKind === 'notes' || normKind === 'idea') normKind = 'note';
    if (normKind === 'goals' || normKind === 'tasks' || normKind === 'task') normKind = 'goal';
    if (normKind === 'forms') normKind = 'form';
    if (normKind === 'events') normKind = 'event';
    if (normKind === 'credentials' || normKind === 'secrets' || normKind === 'secret' || normKind === 'password') normKind = 'credential';
    if (normKind === 'totps') normKind = 'totp';
    if (normKind === 'agent_sessions' || normKind === 'agentic_session' || normKind === 'agentic_sessions' || normKind === 'session' || normKind === 'sessions') normKind = 'agent_session';

    // 1. Query project_objects join table for this workspace
    const poRes = await tables.listRows({
      databaseId: dbId,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', workspaceId),
        Query.limit(500),
      ] as any,
    }).catch(() => ({ rows: [] as any[] }));

    const matchingEntityIds: string[] = [];
    (poRes.rows || []).forEach((po: any) => {
      let k = (po.entityKind || '').toLowerCase();
      if (k === 'ideas' || k === 'notes' || k === 'idea') k = 'note';
      if (k === 'goals' || k === 'tasks' || k === 'task') k = 'goal';
      if (k === 'forms') k = 'form';
      if (k === 'events') k = 'event';
      if (k === 'credentials' || k === 'secrets' || k === 'secret' || k === 'password') k = 'credential';
      if (k === 'totps') k = 'totp';
      if (k === 'agent_sessions' || k === 'agentic_session' || k === 'agentic_sessions' || k === 'session' || k === 'sessions') k = 'agent_session';

      if (k === normKind && po.entityId) {
        matchingEntityIds.push(String(po.entityId));
      }
    });

    const rowsById = new Map<string, any>();

    // Helper to fetch individual rows by matching entityId (from project_objects) and by tags
    const queryAndCollect = async (tableId: string, hasTags = false) => {
      // 1. Fetch all matching entity IDs directly via getRow
      if (matchingEntityIds.length > 0) {
        const rowFetches = matchingEntityIds.map((rowId) =>
          tables
            .getRow({
              databaseId: dbId,
              tableId,
              rowId,
            })
            .catch(() => null)
        );
        const fetchedRows = await Promise.all(rowFetches);
        fetchedRows.forEach((r: any) => {
          if (r && (r.$id || r.id)) {
            const rowId = r.$id || r.id;
            rowsById.set(rowId, {
              ...r,
              id: rowId,
              $id: rowId,
              projectId: workspaceId,
              isWorkspace: true,
            });
          }
        });
      }

      // 2. For tables supporting tags (notes, tasks), also query tags
      if (hasTags) {
        try {
          const [wsTagsRes, projTagsRes] = await Promise.all([
            tables
              .listRows({
                databaseId: dbId,
                tableId,
                queries: [Query.contains('tags', `workspace:${workspaceId}`), Query.limit(200)] as any,
              })
              .catch(() => ({ rows: [] })),
            tables
              .listRows({
                databaseId: dbId,
                tableId,
                queries: [Query.contains('tags', `project:${workspaceId}`), Query.limit(200)] as any,
              })
              .catch(() => ({ rows: [] })),
          ]);

          const tagRows = [
            ...(Array.isArray(wsTagsRes?.rows) ? wsTagsRes.rows : []),
            ...(Array.isArray(projTagsRes?.rows) ? projTagsRes.rows : []),
          ];

          tagRows.forEach((r: any) => {
            if (r && (r.$id || r.id)) {
              const rowId = r.$id || r.id;
              rowsById.set(rowId, {
                ...r,
                id: rowId,
                $id: rowId,
                projectId: workspaceId,
                isWorkspace: true,
              });
            }
          });
        } catch {}
      }
    };

    switch (normKind) {
      case 'note':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.NOTE.NOTES, true);
        break;
      case 'goal':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.TASKS, true);
        break;
      case 'event':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.EVENTS, false);
        break;
      case 'form':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.FORMS, false);
        break;
      case 'credential':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, true);
        break;
      case 'totp':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, true);
        break;
      case 'agent_session':
        await queryAndCollect('agentic_sessions', false);
        break;
      default:
        break;
    }

    const finalRows = Array.from(rowsById.values()).filter((r) => r.isTrash !== true && r.trash !== true);
    return {
      success: true,
      rows: JSON.parse(JSON.stringify(finalRows)),
    };
  } catch (err: any) {
    console.error('[getSharedWorkspaceEntitiesSecure] Error:', err);
    return {
      success: false,
      rows: [],
      error: err?.message || 'Failed to fetch shared workspace entities',
    };
  }
}

/**
 * Server Action to resolve the sealed keyblob for an agent or agentic workspace.
 * Allows client to unwrap the Agent MEK locally using the Owner's Masterpass MEK (3-tier envelope).
 */
export async function resolveAgentKeyBlobSecure(
  agentOrWorkspaceId: string,
  _jwt?: string
): Promise<{ success: boolean; encryptedKeyBlob?: string; mekHex?: string; agentId?: string; error?: string }> {
  try {
    const rawId = String(agentOrWorkspaceId).replace(/^agent_/, '').trim();
    if (!rawId) return { success: false, error: 'Agent ID required' };

    const tables = createSystemTablesDB();
    const dbId = APPWRITE_CONFIG.DATABASES.FLOW;

    // 1. Try direct agent row
    const agentRow = await tables.getRow({
      databaseId: dbId,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.AGENTS || 'agents',
      rowId: rawId,
    }).catch(() => null);

    let resolvedAgentId = rawId;
    let mekHex: string | undefined;
    let encryptedKeyBlob: string | undefined;

    if (agentRow?.config) {
      try {
        const parsed = JSON.parse(agentRow.config);
        if (parsed.mekHex) mekHex = String(parsed.mekHex);
        if (parsed.entropyHex) mekHex = String(parsed.entropyHex);
      } catch {}
    }

    // 2. Try agent by workspaceId
    if (!mekHex && !encryptedKeyBlob) {
      try {
        const wsAgents = await tables.listRows({
          databaseId: dbId,
          tableId: APPWRITE_CONFIG.TABLES.FLOW.AGENTS || 'agents',
          queries: [Query.equal('workspaceId', rawId), Query.limit(1)] as any,
        }).catch(() => ({ rows: [] as any[] }));
        if (wsAgents.rows && wsAgents.rows.length > 0) {
          resolvedAgentId = wsAgents.rows[0].$id;
          if (wsAgents.rows[0].config) {
            const parsed = JSON.parse(wsAgents.rows[0].config);
            if (parsed.mekHex) mekHex = String(parsed.mekHex);
            if (parsed.entropyHex) mekHex = String(parsed.entropyHex);
          }
        }
      } catch {}
    }

    // 3. Try profile table for preferences.encryptedKeyBlob
    try {
      const profileRow = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES || 'profiles',
        queries: [
          Query.equal('userId', `agent_${resolvedAgentId}`),
          Query.limit(1),
        ] as any,
      }).catch(() => ({ rows: [] as any[] }));

      if (profileRow.rows && profileRow.rows.length > 0) {
        const pref = typeof profileRow.rows[0].preferences === 'string'
          ? JSON.parse(profileRow.rows[0].preferences)
          : profileRow.rows[0].preferences;
        if (pref?.encryptedKeyBlob) encryptedKeyBlob = String(pref.encryptedKeyBlob);
        if (!mekHex && pref?.mekHex) mekHex = String(pref.mekHex);
        if (!mekHex && pref?.entropyHex) mekHex = String(pref.entropyHex);
      }
    } catch {}

    // 4. Try sovereign store ~/.kylrix/agents/<agent>.json
    if (!mekHex && !encryptedKeyBlob) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const configDir = path.join(os.homedir(), '.kylrix', 'agents');
        if (fs.existsSync(configDir)) {
          const files = fs.readdirSync(configDir);
          for (const f of files) {
            if (f.endsWith('.json')) {
              try {
                const data = JSON.parse(fs.readFileSync(path.join(configDir, f), 'utf-8'));
                if (data.agentId === resolvedAgentId || data.defaultWorkspaceId === rawId) {
                  if (data.mekHex) mekHex = String(data.mekHex);
                  break;
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    return {
      success: Boolean(encryptedKeyBlob || mekHex),
      encryptedKeyBlob,
      mekHex,
      agentId: resolvedAgentId,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to resolve agent key blob' };
  }
}

