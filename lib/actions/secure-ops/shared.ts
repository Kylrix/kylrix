export { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { ID, Permission, Query, Role, Databases, TablesDB, Account } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getUserSubscriptionTierServer } from '@/lib/services/internal/subscription-entitlement';
import {
  allowsCollaboratorSharing,
  getCollaboratorCap,
  getContainerObjectCap,
  getProjectCap,
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

/**
 * Updates row-level permissions for a resource.
 * Replaces legacy POST /api/permissions.
 */

/**
 * Revokes row-level permissions for a resource.
 * Replaces legacy DELETE /api/permissions.
 */

// Short-lived in-memory cache for row reads during permission checks.
// Prevents duplicate database fetches within a short timeframe (e.g. 5 seconds).
export const rowCache = new Map<string, { row: any; timestamp: number }>();
export const CACHE_TTL_MS = 5000; // 5 seconds


/** 
 * Standard actor discovery for Server Actions. 
 * Reads session cookies or explicit JWT to establish identity.
 */









export type TokenAction =
  | 'state'
  | 'initialize'
  | 'mint_activity'
  | 'transfer'
  | 'ledger'
  | 'balance'
  | 'fine_to_root'
  | 'lock_claim'
  | 'settle_claim';


export const VIEWER_COOKIE = 'kylrix_viewer_id';
const viewerSecret = () => String(process.env.VIEWER_TOKEN_SECRET || process.env.APPWRITE_API || 'kylrix-viewer-secret');
const signViewerToken = (payload: string) => createHmac('sha256', viewerSecret()).update(payload).digest('base64url');
export const issueViewerToken = () => {
  const payload = `${Date.now()}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${signViewerToken(payload)}`;
};
export const isViewerTokenValid = (token: string) => {
  const trimmed = String(token || '').trim();
  if (!trimmed) return false;
  const parts = trimmed.split('.');
  if (parts.length < 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return signViewerToken(payload) === parts[2];
};



/**
 * Session-scoped privileged maintenance (current user only).
 * Replaces legacy /api/me/runtime-functions route.
 */

/**
 * Burns an ephemeral ghost / Send row using a per-note deletion secret.
 * Replaces legacy /api/ephemeral-note/delete.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * Removes the ghost row (and Send ciphertext file) after successful import.
 * Replaces legacy /api/ephemeral-note/consume.
 */

/**
 * Dispatches an unorganic email notification.
 * Replaces legacy /api/emails route.
 */

/**
 * Creates a temporal session token for app handoff.
 * Replaces legacy /api/auth/session route.
 */

/**
 * Resolves user names and avatars for a list of user IDs.
 * Replaces legacy /api/shared/profiles route.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * Fetches a public note and its metadata.
 * Replaces legacy /api/shared/[noteid] route.
 */
/**
 * Read-only public goal/task payload for /flow/goal/[id] guest pages.
 */


/**
 * Fetches comments for a public note.
 * Replaces legacy /api/shared/[noteid]/comments route.
 */

/**
 * Fetches reactions for a public note or target.
 * Replaces legacy /api/shared/[noteid]/reactions route.
 */

/**
 * Fetches referral status and links for the current user.
 * Replaces legacy GET /api/referrals.
 */

/**
 * Applies a referral to the current user.
 * Replaces legacy POST /api/referrals.
 */

/**
 * Resolves a referral profile by username.
 * Replaces legacy GET /api/referrals/[username].
 */

/**
 * MASTER PURGE: Wipes all Tier 2 (Zero-Knowledge) data for the authenticated actor.
 * Triggered upon Master Password Reset.
 * Replaces legacy POST /api/reset-purge.
 */

/**
 * Fetches cross-app action suggestions.
 * Replaces legacy GET /api/cross/suggest.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * Verifies if the authenticated actor has admin privileges.
 * Replaces legacy GET /api/admin/check.
 */

/**
 * Creates a report for one or more target users.
 * Replaces legacy POST /api/reports.
 */

/**
 * Lists reports authored by or targeting the authenticated actor.
 * Replaces legacy GET /api/reports.
 */

/**
 * Creates one or more account event rows (referrals, reports, profile syncs, etc.).
 * Replaces legacy POST /api/account-events.
 */

/**
 * Initializes a new Cloudflare Calls session.
 * Replaces legacy POST /api/calls/session.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * Adds tracks to an existing Cloudflare Calls session.
 * Replaces legacy POST /api/calls/tracks.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * Verifies a Cloudflare Turnstile token.
 * Replaces legacy POST /api/turnstile/verify.
 */

/**
 * Transaction-Clock Delta Sync: Computes surgical patches for notes.
 * Follows "The Golden Rule of Server Action Security".
 * Eliminates thundering herds by returning only changed records.
 */

/**
 * RxDB Replication: Pull Handler (Server -> Client)
 * Fetches changed notes since the last checkpoint.
 * Follows "The Golden Rule of Server Action Security".
 */

/**
 * RxDB Replication: Push Handler (Client -> Server)
 * Persists local changes to the server and detects conflicts.
 * Follows "The Golden Rule of Server Action Security".
 */









/**
 * Parses user IDs and their highest permission level from Appwrite strings.
 */




/**
 * Generic Modular Permission Checker Engine
 * Handles multiple systems for securely carrying out actions.
 * Tightly coupled to:
 * - Create: Tied mathematically to current user (ownerId === actorId)
 * - Update: Current user or collaborator with 'editor'/'admin' level from metadata setting
 * - Delete: Current user or collaborator with 'admin' level from metadata setting
 * - Read (Publicity): Checks metadata fields if publicity is enabled (isPublic is true)
 */




// ==========================================
// PROJECT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================













// ==========================================
// FORM COLLABORATION & CRUD SECURE ACTIONS
// ==========================================







// ==========================================
// EVENT COLLABORATION & CRUD SECURE ACTIONS
// ==========================================








// ==========================================
// CALLS & HUDDLES COHOST SECURE ACTIONS
// ==========================================































/**
 * Server SDK Port: Fetches the profile status row from the profiles table.
 * Bypasses client-side RLS limits using the system tables database.
 */

/**
 * Ruthless Sharing: Unified toggle for isPublic and isGuest flags.
 */


















export type PermissionLevel = 'viewer' | 'editor' | 'admin';

function resolveCollaboratorTypeFilter(tableId?: string) {
  if (!tableId) return null;
  if (tableId === APPWRITE_CONFIG.TABLES.NOTE.NOTES) {
    return Query.equal('resourceType', 'note');
  }
  if (tableId === 'projects') {
    return Query.equal('resourceType', 'project');
  }
  if (tableId === APPWRITE_CONFIG.TABLES.FLOW.EVENTS || tableId === 'events') {
    return Query.equal('resourceType', 'event');
  }
  if (tableId === APPWRITE_CONFIG.TABLES.FLOW.FORMS || tableId === 'forms') {
    return Query.equal('resourceType', 'form');
  }
  if (tableId === 'credentials') {
    return Query.or([
      Query.equal('resourceType', 'secret'),
      Query.equal('resourceType', 'credential'),
    ]);
  }
  if (tableId === 'totpSecrets') {
    return Query.equal('resourceType', 'totp');
  }
  if (tableId === APPWRITE_CONFIG.TABLES.FLOW.TASKS) {
    return Query.equal('resourceType', 'task');
  }
  return null;
}

export interface PermissionChangeInput {
  userId: string;
  resourceId: string;
  resourceType: 'note' | 'task' | 'project' | 'secret' | 'totp';
  resourceTitle: string;
  targetUserId: string;
  targetEmail?: string;
  permission: PermissionLevel;
  actorName: string;
  jwt?: string;
  skipEmail?: boolean;
}


export async function getRowCached(params: { databaseId: string; tableId: string; rowId: string }) {
  const cacheKey = `${params.databaseId}:${params.tableId}:${params.rowId}`;
  const now = Date.now();
  const cached = rowCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.row;
  }
  const db = Registry.getDatabase();
  const row = await db.getRow<any>(params.databaseId, params.tableId, params.rowId, { forceSystem: true });
  if (row) {
    // Prune expired entries to keep memory low
    if (rowCache.size > 100) {
      for (const [key, val] of rowCache.entries()) {
        if (now - val.timestamp > CACHE_TTL_MS) {
          rowCache.delete(key);
        }
      }
    }
    rowCache.set(cacheKey, { row, timestamp: now });
  }
  return row;
}

export async function getActor(jwt?: string) {
  try {
    const actor = await Registry.getAuth().getActor(jwt);
    if (actor) {
        console.log('[secure-ops] Actor established via AuthPort:', actor.$id, actor.email);
    } else {
        console.warn('[secure-ops] Actor discovery via AuthPort returned null');
    }
    return actor;
  } catch (err) {
    console.error('[secure-ops] getActor exception:', err);
    return null;
  }
}

export function isEnvSERVERSDKUser(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  const serverSDKSet = new Set(
    String(process.env.ADMINS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return serverSDKSet.has(email);
}

export function isEnvAdminUser(user: any) {
  // Currently sharing same definition as SERVERSDK but kept separate for architectural growth
  return isEnvSERVERSDKUser(user);
}

export function hasWriteAccess(note: any, actorId: string) {
  const ownerId = String(note?.userId || note?.creatorId || note?.ownerId || '').trim();
  if (ownerId && ownerId === actorId) return true;
  const collaborators = Array.isArray(note?.collaborators) ? note.collaborators : [];
  const collaboratorIds = collaborators
    .map((entry: any) => (typeof entry === 'string' ? entry : entry?.userId || entry?.id || ''))
    .filter(Boolean);
  try {
    const metadata = JSON.parse(note?.metadata || '{}');
    const writeCollaborators = Array.isArray(metadata?.writeCollaborators) ? metadata.writeCollaborators : [];
    collaboratorIds.push(...writeCollaborators.filter(Boolean));
  } catch {}
  return Array.from(new Set(collaboratorIds)).includes(actorId);
}

export function serializeMomentRow(row: Record<string, unknown>) {
  return {
    $id: String(row?.$id || ''),
    $createdAt: row?.$createdAt,
    $updatedAt: row?.$updatedAt,
    userId: String(row?.userId || ''),
    caption: row?.caption ?? '',
    type: row?.type ?? '',
    momentKind: row?.momentKind ?? '',
    sourceId: row?.sourceId ?? null,
    searchTitle: row?.searchTitle ?? null,
    fileId: row?.fileId ?? '',
    createdAt: row?.createdAt ?? '',
    expiresAt: row?.expiresAt ?? '',
  };
}

export function serializeTokenMintResult(raw: unknown): Record<string, unknown> {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return { accepted: false, reason: 'MINT_FAILED' };
  if (r.accepted) {
    return {
      accepted: true,
      ...(r.amount != null ? { amount: String(r.amount) } : {}),
      ...(r.amountMicro != null ? { amountMicro: String(r.amountMicro) } : {}),
      ...(r.symbol != null ? { symbol: String(r.symbol) } : {}),
    };
  }
  return {
    accepted: false,
    reason: String(r.reason || 'MINT_FAILED'),
  };
}

export async function verifyResourcePermissionSecure(params: {
  databaseId?: string;
  tableId?: string;
  rowId?: string;
  actorId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  ownerFields?: string[];
  metadataField?: string;
  data?: any;
}) {
  const { databaseId, tableId, rowId, actorId, action, ownerFields = ['userId', 'ownerId', 'creatorId'], metadataField = 'metadata', data } = params;
  
  let row = null;
  
  // Authoritative existing row fetch for permission validation
  if (databaseId && tableId && rowId) {
    row = await getRowCached({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId,
    }).catch(() => null);

    // Dynamic Admin RLS Bypass Fallback (Second Gate)
    if (!row) {
      try {
        const systemTables = createSystemTablesDB();
        row = await systemTables.getRow(
          databaseId,
          tableId,
          rowId
        );
      } catch (err) {
        console.warn('[verifyResourcePermissionSecure] Admin fallback fetch failed:', err);
      }
    }
  }

  // If no existing row found and it's not a create action, we cannot verify permissions
  if (!row && action !== 'create') {
    return false;
  }

  // Use provided data as fallback (primarily for 'create' or specialized injections)
  if (!row && data) {
    row = data;
  }

  if (!row) {
    return false;
  }
  
  let ownerId = '';
  for (const field of ownerFields) {
    const val = String(row[field] || '').trim();
    if (val) {
      ownerId = val;
      break;
    }
  }

  const isOwner = ownerId && ownerId === actorId;

  if (isOwner) {
    return true;
  }

  // Check if collaboration is suspended due to owner losing Pro/Teams plan
  let isCollaborationSuspended = false;
  if (ownerId && actorId !== ownerId) {
    try {
      const { users } = createSystemClient();
      const ownerUser = await users.get(ownerId).catch(() => null);
      if (ownerUser) {
        const ownerTier = await getUserSubscriptionTierServer(ownerId);
        const isProject = tableId === 'projects' || row.resourceType === 'project';
        if (isProject) {
          const isTeams = ownerTier === 'TEAMS' || ownerTier === 'ORG' || ownerTier === 'LIFETIME';
          if (!isTeams) {
            isCollaborationSuspended = true;
          }
        } else {
          const isProOrTeams = ownerTier === 'PRO' || ownerTier === 'TEAMS' || ownerTier === 'ORG' || ownerTier === 'LIFETIME';
          if (!isProOrTeams) {
            isCollaborationSuspended = true;
          }
        }
      }
    } catch (e) {
      console.warn('[verifyResourcePermissionSecure] Failed to check owner plan:', e);
    }
  }

  if (isCollaborationSuspended) {
    // Non-owner collaborators lose write access immediately
    if (action !== 'read') {
      return false;
    }
    // For reads: allow standalone projects to render (so they can see details/disabled banner in UI)
    const isProject = tableId === 'projects' || row.resourceType === 'project';
    if (!isProject) {
      // For objects (notes, tasks, etc.): only allowed if the resource is public/guest
      const isPublic = row.isPublic === true || row.isGuest === true;
      if (!isPublic) {
        return false;
      }
    }
  }

  // 0. Inherited Project Ownership
  // Case A: Authoritative resourceType/resourceId link (standard for Notes/Secrets)
  if (actorId && row.resourceType === 'project' && row.resourceId) {
    try {
      const project = await getRowCached({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'projects',
        rowId: row.resourceId,
      });
      if (project && project.ownerId === actorId) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance (Case A) check failed:', err);
    }
  }

  // Case B: Explicit projectId column (standard for Tasks/Goals)
  if (actorId && row.projectId) {
    try {
      const project = await getRowCached({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'projects',
        rowId: row.projectId,
      });
      if (project && project.ownerId === actorId) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance (Case B) check failed:', err);
    }
  }

  // 0.1 Parent Resource Inheritance (e.g. Comments in a Note)
  if (actorId && tableId === 'comments' && row.noteId) {
    try {
      const hasParentAccess = await verifyResourcePermissionSecure({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
        rowId: row.noteId,
        actorId,
        action: action as any,
      });
      if (hasParentAccess) return true;
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Parent note inheritance check failed:', err);
    }
  }

  if (action === 'create') {
    // For create operations, if the user is not the owner (isOwner is false), they cannot create it.
    // This mathematically ties the create operation strictly to the current user.
    return false;
  }

  // 1. Native Visibility Flags (isPublic, isGuest)
  // These grant universal read-only access based on the new native columns.
  const isGuest = row.isGuest === true;
  const isPublic = row.isPublic === true;

  // 2. Project-Level Inheritance (isGeneral)
  // If a resource is linked to a project with isGeneral = true, all project members inherit read access.
  let isInheritedGeneralRead = false;
  if (action === 'read' && rowId) {
    try {
      const tables = createSystemTablesDB();
      const objLinks = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        queries: [Query.equal('entityId', rowId)] as any
      });
      
      for (const link of objLinks.rows) {
        if (link.isGeneral === true) {
          const project = await getRowCached({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'projects',
            rowId: link.projectId
          });

          if (project) {
            if (project.ownerId === actorId) {
                isInheritedGeneralRead = true;
                break;
            }
            // Check if current user is an explicit collaborator in that project
            const projectCollabs = await tables.listRows({
                databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                tableId: 'project_objects',
                queries: [
                    Query.equal('projectId', link.projectId),
                    Query.equal('entityKind', 'collaborator'),
                    Query.equal('entityId', actorId)
                ] as any
            }).catch(() => ({ rows: [] }));
            
            if (projectCollabs.rows.length > 0) {
                isInheritedGeneralRead = true;
                break;
            }
          }
        }
      }
    } catch (err) {
      console.error('[verifyResourcePermissionSecure] Inheritance check failed:', err);
    }
  }

  if (action === 'read') {
    if (isPublic || isInheritedGeneralRead) return true;
    if (isGuest && !actorId) return true; 
  }

  // 3. Discrete Access Control: Collaborators table / legacy metadata.collaborators
  let matchedCollabRole: 'viewer' | 'editor' | 'admin' | null = null;

  if (actorId && rowId && (tableId === 'projects' || row.resourceType === 'project')) {
    try {
      const { teams } = createSystemClient();
      const memberships = await teams.listMemberships(rowId).catch(() => ({ memberships: [] }));
      const membership = memberships.memberships.find((m: any) => m.userId === actorId);
      if (membership) {
        if (membership.roles.includes('admin')) matchedCollabRole = 'admin';
        else if (membership.roles.includes('write')) matchedCollabRole = 'editor';
        else matchedCollabRole = 'viewer';
      }
    } catch (teamErr: any) {
      console.warn('[verifyResourcePermissionSecure] Failed to check Appwrite team memberships:', teamErr?.message);
    }
  } else if (actorId && rowId) {
    try {
      const tables = createSystemTablesDB();
      const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
      const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const resourceTypeFilter = resolveCollaboratorTypeFilter(tableId);
      const collabQueries = [
        Query.equal('resourceId', rowId),
        Query.equal('userId', actorId),
      ] as any[];
      if (resourceTypeFilter) {
        collabQueries.push(resourceTypeFilter);
      }
      
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: collabQueries
      });
      
      if (collabsRes.rows.length > 0) {
        const p = collabsRes.rows[0].permission; // 'read' | 'write' | 'admin'
        if (p === 'admin') matchedCollabRole = 'admin';
        else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
        else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
      } else {
        // Hybrid Team Expansion Check
        const teamId = `rt_${rowId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30)}`;
        const teamCollabsRes = await tables.listRows({
          databaseId: FLOW_DATABASE_ID,
          tableId: COLLABORATORS_TABLE,
          queries: [
            Query.equal('resourceId', teamId),
            Query.equal('resourceType', 'team'),
            Query.equal('userId', actorId)
          ] as any
        });
        
        if (teamCollabsRes.rows.length > 0) {
          const p = teamCollabsRes.rows[0].permission;
          if (p === 'admin') matchedCollabRole = 'admin';
          else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
          else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
        }
      }
    } catch (err) {
      console.error('[verifyResourcePermissionSecure] Polymorphic table check failed:', err);
    }
  }

  // Legacy fallback to metadata.collaborators
  if (!matchedCollabRole) {
    let meta: any = {};
    try {
      const rawMeta = row[metadataField];
      meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta || {};
    } catch {}
    const collaborators = meta.collaborators || {};
    const userRole = collaborators[actorId];
    if (userRole) {
      matchedCollabRole = userRole;
    }
  }

  if (action === 'read') {
    if (matchedCollabRole) {
      return ['viewer', 'editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'update') {
    if (matchedCollabRole) {
      return ['editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'delete') {
    if (matchedCollabRole) {
      return matchedCollabRole === 'admin';
    }
    return false;
  }

  return false;
}

export async function verifyNotePermission(noteId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId', 'creatorId', 'ownerId'],
    metadataField: 'metadata',
  });
}

export async function verifyProjectPermission(projectId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['ownerId', 'userId'],
    metadataField: 'metadata',
  });
}

export async function verifyFormPermission(formId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete',
  };
  return verifyResourcePermissionSecure({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    rowId: formId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId', 'creatorId', 'ownerId'],
    metadataField: 'settings',
  });
}

export async function verifyEventPermission(eventId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
    });
  
  const ownerId = String(event.userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true; // Owner has full permissions
  }

  // A. Check polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', actorId),
        Query.limit(1),
      ] as any,
    });
    if (collabsRes.rows.length > 0) {
      const collab = collabsRes.rows[0];
      const p = collab.permission; // 'read' | 'write' | 'admin'
      if (minLevel === 'viewer') {
        if (['read', 'write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'editor') {
        if (['write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'admin') {
        if (p === 'admin') return true;
      }
    }
  } catch (err) {
    console.error('[verifyEventPermission] Polymorphic query failed:', err);
  }

  // B. Fallback to legacy guests table check
  const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', actorId),
      Query.limit(1)
    ] as any,
    });

  if (guestsRes.rows.length === 0) return false;

  const guest = guestsRes.rows[0];
  const role = String(guest.role || '').trim(); // e.g. 'manager-viewer', 'manager-editor', 'manager-admin'

  if (!role.startsWith('manager-')) return false;

  const managerLevel = role.replace('manager-', ''); // 'viewer' | 'editor' | 'admin'

  if (minLevel === 'viewer') {
    return ['viewer', 'editor', 'admin'].includes(managerLevel);
  }
  if (minLevel === 'editor') {
    return ['editor', 'admin'].includes(managerLevel);
  }
  if (minLevel === 'admin') {
    return managerLevel === 'admin';
  }
  return false;
}

export function sanitizeEventData(data: any) {
  if (!data || typeof data !== 'object') return {};
  const allowedKeys = [
    'title',
    'description',
    'startTime',
    'endTime',
    'location',
    'meetingUrl',
    'visibility',
    'status',
    'coverImageId',
    'recurrenceRule',
    'calendarId',
    'userId',
    'isPublic',
    'isPinned',
    'isGuest',
    'keepPermission',
    'source'
  ];
  const sanitized: any = {};
  for (const key of allowedKeys) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}
