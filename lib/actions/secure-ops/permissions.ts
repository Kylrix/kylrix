import * as shared from './shared';
import {
  ID, Permission, Query, Role, Databases, TablesDB, Account
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import {
  allowsCollaboratorSharing,
  getCollaboratorCap,
  getContainerObjectCap,
  getProjectCap
} from '@/lib/entitlements';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { Registry } from '@/lib/core/di/registry';
import { createServerClient } from '@/lib/appwrite/server';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { applyPermissionMutation, revokePermissionMutation } from '@/lib/services/internal/permissions';
import { normalizeTargetUserIds, upsertLockboxRows, provisionHybridTeamExpansionSecure } from '@/lib/api/permission-updater';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';
import { executeSessionRuntimeJob, isSessionRuntimeJobId } from '@/lib/runtime-functions/session-jobs';
import { isMfaRequiredError } from '@/lib/mfa';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';
import { permissionsInternal } from '@/lib/services/internal/permissions';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { dispatchSecureNotification } from '@/lib/services/internal/notification-dispatcher';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import { verifyCreatorDeletionProof } from '@/lib/ephemeral/ephemeral-proof';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import {
  MutatePermissionsSchema,
  IDSchema,
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema,
  NoteSchema,
  ProjectSchema,
  EventSchema,
  FormSchema,
  TokenOperationSchema,
  TelemetrySchema,
  EphemeralNoteSchema,
  SuggestionParamsSchema
} from '@/lib/validations/schemas';
import {
  isValidAppwriteRowId,
  normalizeCollaboratorResourceType,
  resolveResourceOwnerId,
} from '@/lib/utils/resource-ids';

// Import interfaces / types from shared
import { PermissionChangeInput, PermissionLevel, TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  hasWriteAccess,
  serializeMomentRow,
  verifyResourcePermissionSecure,
  verifyNotePermission,
  verifyProjectPermission,
  verifyFormPermission,
  verifyEventPermission,
  sanitizeEventData,
  serializeTokenMintResult,
  rowCache,
  CACHE_TTL_MS,
  VIEWER_COOKIE,
  isViewerTokenValid,
  issueViewerToken,
  cookies
} = shared;

export async function mutatePermissionsSecure(body: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  // Rigorous runtime validation
  const validated = MutatePermissionsSchema.parse(body);
  const action = validated.action;

  if (action === 'pin_ghost_note') {
    const noteIds = normalizeTargetUserIds(validated.noteIds || validated.resourceIds || validated.resourceId);
    const wrappedKey = validated.wrappedKey || validated.ghostSecret;
    if (noteIds.length === 0) throw new Error('At least one noteId is required');
    if (!wrappedKey) throw new Error('wrappedKey is required');

    const keyMappings = noteIds.map((noteId) => ({
      resourceId: noteId,
      resourceType: validated.resourceType || 'ghost_note',
      grantee: actor.$id,
      wrappedKey,
      metadata: validated.metadata || null,
    }));
    const { databases } = createSystemClient();
    const rows = await upsertLockboxRows(databases, actor.$id, keyMappings);
    return { success: true, action, rows };
  }

  const result = await applyPermissionMutation(actor.$id, validated);
  return {
    success: true,
    action,
    rowId: validated.rowId || null,
    permissions: (result as any)?.permissions || null,
  };
}

export async function revokePermissionsSecure(body: any, targetUserId?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  // Rigorous runtime validation
  const validated = MutatePermissionsSchema.parse(body);
  const validatedTargetUserId = IDSchema.optional().parse(targetUserId);

  await revokePermissionMutation(actor.$id, validated, validatedTargetUserId);
  return { success: true, action: 'revoke', rowId: validated.rowId || null };
}

export async function grantPermissionSecure(input: PermissionChangeInput) {
  const requester = await getActor(input.jwt);
  if (!requester) {
      console.error('[secure-ops] grantPermissionSecure: Actor null');
      throw new Error('Unauthorized');
  }

  if (!isValidAppwriteRowId(input.resourceId)) {
    throw new Error('Resource is not saved online yet. Save it first, then share.');
  }

  const normalizedResourceType = normalizeCollaboratorResourceType(input.resourceType);
  if (!normalizedResourceType) {
    throw new Error(`Unsupported resource type: ${input.resourceType}`);
  }
  const resourceType = normalizedResourceType;

  const { client, users, teams } = createSystemClient();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let targetUserIdToUse = input.targetUserId;
  let isEcosystemUser = true;

  if (emailRegex.test(input.targetUserId)) {
    isEcosystemUser = false;
    try {
      const userList = await users.list([Query.equal('email', input.targetUserId)]);
      if (userList.users.length > 0) {
        targetUserIdToUse = userList.users[0].$id;
        isEcosystemUser = true;
      }
    } catch (e) {
      console.warn('[grantPermissionSecure] Failed to check user by email:', e);
    }
  }

  // Handle Project Team synchronization
  if (resourceType === 'project') {
    try {
        await teams.createMembership(
            input.resourceId, 
            [input.permission], 
            `${window.location.origin}/project/${input.resourceId}`, 
            !isEcosystemUser ? input.targetUserId : undefined, 
            isEcosystemUser ? targetUserIdToUse : undefined
        );
    } catch (teamErr: any) {
        console.warn('[grantPermissionSecure] Team membership sync skipped or failed:', teamErr?.message);
    }
  }

  const dbId = resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
               resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
               resourceType === 'secret' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
               resourceType === 'totp' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
               APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                  resourceType === 'project' ? 'projects' :
                  resourceType === 'secret' ? 'credentials' :
                  resourceType === 'totp' ? 'totpSecrets' :
                  APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  // 1. Grant physical READ permission only for ecosystem users
  if (isEcosystemUser) {
    await permissionsInternal('POST', {
      action: 'grant',
      permission: 'read',
      targetUserId: targetUserIdToUse,
      resourceId: input.resourceId,
      resourceType: resourceType === 'note' ? 'ghost_note' : (resourceType === 'secret' || resourceType === 'totp' ? 'secret' : 'task'),
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    }, requester.$id);
  }

  // 2. Set virtual permission in polymorphic flow.collaborators table
  if (resourceType === 'note' || resourceType === 'project' || resourceType === 'secret' || resourceType === 'totp') {
    const tables = createSystemTablesDB();
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

    const collabTypeFilter = resourceType === 'secret'
      ? Query.or([
          Query.equal('resourceType', 'secret'),
          Query.equal('resourceType', 'credential'),
        ])
      : Query.equal('resourceType', resourceType);

    // Enforce 3-collaborator limit for FREE tier
    const existingCollabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', input.resourceId),
        collabTypeFilter,
      ] as any
    });

    const userTier = getUserSubscriptionTier(requester);
    if (!allowsCollaboratorSharing(userTier, resourceType)) {
      if (resourceType === 'project') {
        throw new Error('Project collaboration is a TEAMS feature. Upgrade to TEAMS to collaborate on projects.');
      }
      throw new Error(`Adding collaborators is a premium feature. Upgrade to PRO or TEAMS to collaborate on your ${resourceType}.`);
    }
    const maxCollabs = getCollaboratorCap(userTier, resourceType);
    if (existingCollabsRes.rows.length >= maxCollabs) {
      if (resourceType === 'project') {
        throw new Error('Project collaboration is limited to TEAMS plan. Upgrade to TEAMS for unlimited team members.');
      }
      throw new Error(`Limit reached. Upgrade to PRO or TEAMS for unlimited collaborators on your ${resourceType}.`);
    }

    const existingCollab = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', input.resourceId),
        collabTypeFilter,
        Query.equal('userId', targetUserIdToUse)
      ] as any
    });

    const permission = input.permission === 'admin' ? 'admin' : (input.permission === 'editor' ? 'write' : 'read');

    if (existingCollab.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existingCollab.rows[0].$id,
        data: {
          permission,
          status: isEcosystemUser ? 'accepted' : 'pending',
          accepted: isEcosystemUser
        }
      });
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: input.resourceId,
          resourceType,
          userId: targetUserIdToUse,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: isEcosystemUser,
          status: isEcosystemUser ? 'accepted' : 'pending',
          role: 'collaborator'
        }
      });
    }
  }

  // 3. Structured Email Invitation for non-ecosystem email targets
  if (!isEcosystemUser) {
    try {
      await dispatchEmail({
        eventType: 'invite',
        sourceApp: 'kylrix',
        actorName: input.actorName || requester.name || 'A teammate',
        actorId: requester.$id,
        recipientEmails: [input.targetUserId],
        resourceId: input.resourceId,
        resourceTitle: input.resourceTitle,
        resourceType: resourceType,
        rightsLabel: input.permission,
        metadata: {
          customSubject: `${input.actorName || requester.name || 'A teammate'} invited you to collaborate on '${input.resourceTitle || 'Resource'}' [${resourceType}]`
        }
      });
    } catch (emailErr) {
      console.error('[grantPermissionSecure] Failed to send email invite:', emailErr);
    }
  } else if (!input.skipEmail) {
    try {
      await dispatchSecureNotification({
        targetUserId: targetUserIdToUse,
        type: 'invite',
        title: 'New Invitation',
        body: `${input.actorName} has invited you to collaborate.`,
        actorName: input.actorName,
        resourceId: input.resourceId,
        resourceTitle: input.resourceTitle,
        resourceType: input.resourceType as any,
        permission: input.permission
      });
    } catch (notifErr) {
      console.error('[grantPermissionSecure] Notification dispatch failed:', notifErr);
    }
  }

  return { success: true };
}

export async function revokePermissionSecure(input: {
    resourceId: string;
    resourceType: 'note' | 'task' | 'project';
    targetUserId: string;
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    const { teams } = createSystemClient();

    // Handle Project Team synchronization
    if (input.resourceType === 'project') {
      try {
          // List memberships to find the one to delete
          const memberships = await teams.listMemberships(input.resourceId);
          const membership = memberships.memberships.find(m => m.userId === input.targetUserId);
          if (membership) {
              await teams.deleteMembership(input.resourceId, membership.$id);
          }
      } catch (teamErr: any) {
          console.warn('[revokePermissionSecure] Team membership removal skipped or failed:', teamErr?.message);
      }
    }

    const dbId = input.resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
                 input.resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
                 APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = input.resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                    input.resourceType === 'project' ? 'projects' :
                    APPWRITE_CONFIG.TABLES.FLOW.TASKS;

    // 1. Physically revoke from row
    await permissionsInternal('POST', {
        action: 'revoke',
        targetUserId: input.targetUserId,
        resourceId: input.resourceId,
        resourceType: input.resourceType === 'note' ? 'ghost_note' : 'task',
        databaseId: dbId,
        tableId: tableId,
        rowId: input.resourceId,
    }, requester.$id);

    // 2. Remove virtual permission from metadata for legacy compatibility
    if (input.resourceType === 'note') {
        const tables = createSystemTablesDB();
        const noteRow = await tables.getRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
    });
        let meta: any = {};
        try {
            meta = JSON.parse(noteRow.metadata || '{}');
        } catch {}
        if (meta.collaborators) {
            delete meta.collaborators[input.targetUserId];
            await tables.updateRow({
      databaseId: dbId,
      tableId: tableId,
      rowId: input.resourceId,
      data: {
                metadata: JSON.stringify(meta)
            },
    });
        }
    }

    // 3. Remove polymorphic collaborators row for any resource type
    try {
      const tables = createSystemTablesDB();
      const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
      const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', input.resourceId),
          Query.equal('resourceType', input.resourceType),
          Query.equal('userId', input.targetUserId)
        ] as any
      });
      await Promise.all(
        collabsRes.rows.map((row) =>
          tables.deleteRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id
          })
        )
      );
    } catch (err) {
      console.error('[revokePermissionSecure] Failed to remove polymorphic collaborator row:', err);
    }

    return { success: true };
}

function extractCollaboratorsFromPermissions(permissions: string[]): Array<{ userId: string, level: string }> {
    const userMap = new Map<string, Set<string>>();
    const userRegex = /^(read|update|delete)\("user:([^"]+)"\)$/;
    
    for (const perm of permissions) {
        const match = perm.match(userRegex);
        if (match) {
            const [ type, userId] = match;
            if (!userMap.has(userId)) userMap.set(userId, new Set());
            userMap.get(userId)!.add(type);
        }
    }
    
    return Array.from(userMap.entries()).map(([userId, types]) => {
        let level = 'viewer';
        if (types.has('delete')) level = 'admin';
        else if (types.has('update')) level = 'editor';
        return { userId, level };
    });
}

export async function getResourceCollaboratorsSecure(input: {
    resourceId: string;
    resourceType: 'note' | 'task' | 'project' | 'event' | 'form' | 'huddle' | 'call' | 'secret' | 'totp' | string;
    jwt?: string;
}) {
    const requester = await getActor(input.jwt);
    if (!requester) throw new Error('Unauthorized');

    if (!isValidAppwriteRowId(input.resourceId)) {
        return { collaborators: [] };
    }

    const resourceType = normalizeCollaboratorResourceType(input.resourceType);
    if (!resourceType) {
        return { collaborators: [] };
    }

    const dbId = resourceType === 'note' ? APPWRITE_CONFIG.DATABASES.NOTE : 
                 resourceType === 'project' ? APPWRITE_CONFIG.DATABASES.CHAT :
                 resourceType === 'secret' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
                 resourceType === 'totp' ? (APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb') :
                 resourceType === 'event' || resourceType === 'form' ? APPWRITE_CONFIG.DATABASES.FLOW :
                 resourceType === 'huddle' || resourceType === 'call' ? APPWRITE_CONFIG.DATABASES.CHAT :
                 APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = resourceType === 'note' ? APPWRITE_CONFIG.TABLES.NOTE.NOTES : 
                    resourceType === 'project' ? 'projects' :
                    resourceType === 'event' ? (APPWRITE_CONFIG.TABLES.FLOW.EVENTS || 'events') :
                    resourceType === 'form' ? (APPWRITE_CONFIG.TABLES.FLOW.FORMS || 'forms') :
                    resourceType === 'huddle' ? 'huddles' :
                    resourceType === 'call' ? 'calls' :
                    resourceType === 'secret' ? 'credentials' :
                    resourceType === 'totp' ? 'totpSecrets' :
                    APPWRITE_CONFIG.TABLES.FLOW.TASKS;

    const tables = createSystemTablesDB();
    let row: Record<string, unknown> | null = null;
    try {
      row = await tables.getRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: input.resourceId,
      }) as Record<string, unknown>;
    } catch {
      return { collaborators: [] };
    }
    
    let filteredCollabs: Array<{ userId: string, level: string, status: string, accepted: boolean }> = [];
    
    if (resourceType === 'project') {
        // Query native Appwrite Team members directly
        try {
            const { teams } = createSystemClient();
            // Project ID is the Team ID
            const memberships = await teams.listMemberships(input.resourceId);
            filteredCollabs = memberships.memberships.map((m: any) => ({
                userId: m.userId,
                level: m.roles.includes('admin') ? 'admin' : (m.roles.includes('write') ? 'editor' : 'viewer'),
                status: m.confirm ? 'accepted' : 'pending',
                accepted: m.confirm
            }));
        } catch (teamErr: any) {
            console.warn('[getResourceCollaboratorsSecure] Failed to query native team:', teamErr?.message);
        }
    } else if (resourceType === 'note' || resourceType === 'event' || resourceType === 'form' || resourceType === 'huddle' || resourceType === 'call' || resourceType === 'secret' || resourceType === 'totp') {
        // Query polymorphic collaborators table as the single source of truth
        try {
            const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
            const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
            const collabTypeFilter = resourceType === 'secret'
              ? Query.or([
                  Query.equal('resourceType', 'secret'),
                  Query.equal('resourceType', 'credential'),
                ])
              : Query.equal('resourceType', resourceType);
            const collabsRes = await tables.listRows({
                databaseId: FLOW_DATABASE_ID,
                tableId: COLLABORATORS_TABLE,
                queries: [
                    Query.equal('resourceId', input.resourceId),
                    collabTypeFilter,
                ] as any
            });

            if (collabsRes.rows.length > 0) {
                filteredCollabs = collabsRes.rows.map(c => ({
                    userId: c.userId,
                    level: c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer'),
                    status: (c.status === 'pending' && (!c.inviterId || c.inviterId === '')) ? 'requested' : (c.status || 'pending'),
                    accepted: c.accepted ?? false
                }));
            } else {
                // Legacy fallback to metadata.collaborators
                let meta: any = {};
                try {
                    meta = JSON.parse(String(row.metadata || '{}'));
                } catch {}
                const collaboratorsMap = meta.collaborators || {};
                filteredCollabs = Object.entries(collaboratorsMap).map(([userId, level]) => ({
                    userId,
                    level: String(level),
                    status: 'accepted',
                    accepted: true
                }));
            }
        } catch (e) {
            console.warn('[getResourceCollaboratorsSecure] Failed to query polymorphic status:', e);
        }
    } else {
        // Fallback for tasks
        const rawPermissions = row.$permissions || [];
        const collabMeta = extractCollaboratorsFromPermissions(rawPermissions as string[]);
        const ownerId = resolveResourceOwnerId(row);
        filteredCollabs = collabMeta
            .filter(c => c.userId !== ownerId && c.userId !== requester.$id)
            .map(c => ({ userId: c.userId, level: c.level, status: 'accepted', accepted: true }));
    }

    if (filteredCollabs.length === 0) return { collaborators: [] };

    // 3. Hydrate profiles
    const { UsersService } = await import('@/lib/services/users');
    const collaborators = await Promise.all(
        filteredCollabs.map(async (collab) => {
            const p = await UsersService.getProfileById(collab.userId);
            if (!p) return null;
            return {
                $id: p.$id,
                userId: p.userId || p.$id,
                username: p.username,
                displayName: p.displayName,
                avatar: p.avatar || p.profilePicId || null,
                tier: p.tier,
                verified: p.tier === 'admin' || p.verified,
                permissionLevel: collab.level,
                status: collab.status,
                accepted: collab.accepted
            };
        })
    );

    return { collaborators: collaborators.filter(Boolean) };
}

export async function addProjectCollaboratorSecure(projectId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();

  // 1. Fetch current project
  const project = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });

  // Enforce 3-collaborator limit for FREE tier
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  const existingCollabsRes = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project')
    ] as any
  });

  // Fetch owner to check plan
  const { users } = createSystemClient();
  const owner = await users.get(project.ownerId);
  const ownerTier = getUserSubscriptionTier(owner);

  if (!allowsCollaboratorSharing(ownerTier, 'project')) {
    throw new Error('Project collaboration is a TEAMS feature. Upgrade the project owner to TEAMS to collaborate on projects.');
  }

  const maxCollabs = getCollaboratorCap(ownerTier, 'project');
  if (existingCollabsRes.rows.length >= maxCollabs) {
    throw new Error('Project collaboration is limited to TEAMS plan. Upgrade the project owner to TEAMS for unlimited team members.');
  }

  const { teams } = createSystemClient();
  const teamRole = permissionLevel === 'admin'
    ? 'admin'
    : (permissionLevel === 'editor' || permissionLevel === 'write' ? 'editor' : 'viewer');

  // Create native Appwrite Team membership directly (discards polymorphic table for projects)
  try {
    const inviteUrl = `${window.location.origin}/project/${projectId}`;
    try {
      await teams.get(projectId);
    } catch {
      await teams.create(projectId, project.title || 'Project Team');
    }
    await teams.createMembership(
      projectId,
      [teamRole],
      inviteUrl,
      undefined,
      targetUserId
    );
  } catch (err: any) {
    console.error('[addProjectCollaboratorSecure] Appwrite Team membership creation failed:', err?.message);
    throw err;
  }

  // 3. Dispatch structured notification email + companion Telegram alert
  try {
    await dispatchSecureNotification({
      targetUserId,
      type: 'invite',
      title: 'Project Invitation',
      body: `${actor.name || 'A Kylrix user'} has invited you to collaborate on the project "${project.title}".`,
      actorName: actor.name || 'A teammate',
      resourceId: projectId,
      resourceTitle: project.title,
      resourceType: 'project',
      permission: permissionLevel
    });
  } catch (err) {
    console.error('[addProjectCollaboratorSecure] Notification dispatch failed:', err);
  }

  return { success: true, pending: true };
}

export async function removeProjectCollaboratorSecure(projectId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases, teams } = createSystemClient();

  // 1. Sync to native Appwrite Team for optimized read-access
  try {
      const teamId = projectId;
      const memberships = await teams.listMemberships(teamId);
      const membership = memberships.memberships.find(m => m.userId === targetUserId);
      if (membership) {
          await teams.deleteMembership(teamId, membership.$id);
      }
  } catch (teamErr: any) {
      console.warn('[removeProjectCollaboratorSecure] Team membership removal skipped or failed:', teamErr?.message);
  }

  // 2. Fetch current project to update permissions
  const project = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
    });
  // Remove physical read permission
  const rawPermissions = project.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  // Remove from metadata.collaborators
  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}
  if (metadata.collaborators) {
    delete metadata.collaborators[targetUserId];
  }

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      metadata: JSON.stringify(metadata),
    },
      permissions: updatedPerms,
    });

  // 2. Remove all collaborator objects from project_objects
  try {
    const objects = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', targetUserId)] as any,
    });
    await Promise.all(
      objects.rows.map((obj) =>
        tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: obj.$id,
    })
      )
    );
  } catch (err) {
    console.error('removeProjectCollaboratorSecure objects cleanup failed:', err);
  }

  // 3. E2E Private Chat Group Member Auto-Sync
  if (metadata && metadata.encryptedGroupId) {
    try {
      const convId = metadata.encryptedGroupId;
      const memberRows = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', convId),
          Query.equal('userId', targetUserId)
        ] as any
      }).catch(() => ({ rows: [] }));

      await Promise.all(
        memberRows.rows.map((row) =>
          tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
            tableId: 'conversationMembers',
            rowId: row.$id
          })
        )
      );
    } catch (e) {
      console.warn('[removeProjectCollaboratorSecure] Failed to sync from E2E project group:', e);
    }
  }

  // 4. Remove polymorphic collaborators row
  try {
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', projectId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', targetUserId)
      ] as any
    });
    await Promise.all(
      collabsRes.rows.map((row) => {
        const isJoinRequest = row.status === 'pending' && (!row.inviterId || row.inviterId === '');
        if (isJoinRequest) {
          return tables.updateRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id,
            data: {
              status: 'declined',
              accepted: false,
            }
          });
        } else {
          return tables.deleteRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: COLLABORATORS_TABLE,
            rowId: row.$id
          });
        }
      })
    );
  } catch (err) {
    console.error('[removeProjectCollaboratorSecure] Polymorphic collaborators cleanup failed:', err);
  }

  return { success: true };
}

export async function addFormCollaboratorSecure(formId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (!settings.collaborators) {
    settings.collaborators = {};
  }
  settings.collaborators[targetUserId] = permissionLevel;

  const permissions = new Set(form.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: {
      settings: JSON.stringify(settings),
    },
      permissions: Array.from(permissions),
    });

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function removeFormCollaboratorSecure(formId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage collaborators');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
    });

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (settings.collaborators) {
    delete settings.collaborators[targetUserId];
  }

  const rawPermissions = form.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: {
      settings: JSON.stringify(settings),
    },
      permissions: updatedPerms,
    });

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function requestResourceAccessSecure(resourceId: string, resourceType: 'project' | 'note', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // Check if they already have an entry
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', resourceId),
      Query.equal('resourceType', resourceType),
      Query.equal('userId', actor.$id)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    const col = existingCollab.rows[0];
    return { success: true, status: col.status };
  }

  // Create a collaborator row with status: 'pending'
  await tables.createRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    rowId: ID.unique(),
    data: {
      resourceId,
      resourceType,
      userId: actor.$id,
      permission: 'read',
      invitedAt: new Date().toISOString(),
      accepted: false,
      status: 'pending',
      role: 'collaborator',
      inviterId: ''
    }
  });

  return { success: true, status: 'requested' };
}
