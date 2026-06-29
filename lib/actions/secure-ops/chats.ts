'use server';

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

export async function initCloudflareCallSessionSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function initCloudflareCallTracksSecure(params: { sessionId: string; tracks: any[] }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { sessionId, tracks } = params;
  const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API;
  const CLOUDFLARE_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_APP_ID;

  if (!CLOUDFLARE_API_KEY || !CLOUDFLARE_APP_ID) {
    throw new Error('Cloudflare configuration missing');
  }

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}/sessions/${sessionId}/tracks/new`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tracks }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function cleanupStaleCallsSecure(input?: { userId?: string; callId?: string | null; cleanupAll?: boolean }) {
  const requester = await getActor();
  if (!requester) return { success: false, reason: 'Unauthorized' };

  const admin = isEnvAdminUser(requester);
  const targetUserId = String(input?.userId || requester.$id || '').trim();
  const callId = String(input?.callId || '').trim() || null;
  const cleanupAll = Boolean(input?.cleanupAll);

  const tables = createSystemTablesDB();
  const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

  if (cleanupAll && admin) {
    const rows = await tables.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
      Query.lessThan('expiresAt', new Date().toISOString()),
      Query.limit(500)],
    });
    for (const row of rows.rows) {
      await tables.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
    }
    return { deleted: rows.rows.length, callIds: rows.rows.map((row) => row.$id) };
  }

  if (targetUserId !== requester.$id && !admin && !callId) throw new Error('Forbidden');

  if (callId) {
    const call = await tables.getRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: callId,
    });
    if (String((call as any)?.userId || '') !== (admin ? (targetUserId || requester.$id) : requester.$id)) {
      throw new Error('Forbidden');
    }
    const result = await deleteCallIfExpired(tables as any, callId);
    const presenceUser = targetUserId || requester.$id;
    await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
    return result.deleted ? { deleted: 1, callIds: [callId] } : { deleted: 0, callIds: [] as string[] };
  }

  const expiredRows = await tables.listRows({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      queries: [
    Query.equal('userId', targetUserId || requester.$id),
    Query.lessThan('expiresAt', new Date().toISOString()),
    Query.limit(200)],
    });
  for (const row of expiredRows.rows) {
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: LINKS_TABLE,
      rowId: row.$id,
    });
  }
  const presenceUser = targetUserId || requester.$id;
  await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);
  return { deleted: expiredRows.rows.length, callIds: expiredRows.rows.map((row) => row.$id) };
}

export async function addCallCohostSecureAction(callId: string, cohostId: string, allowEndCall: boolean = false, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  if (ownerId !== actor.$id) {
    throw new Error('Forbidden: Only the call host can manage co-hosts');
  }

  let meta: any = {};
  try {
    meta = JSON.parse(call.metadata || '{}');
  } catch {}
  if (!meta.cohosts) {
    meta.cohosts = {};
  }
  meta.cohosts[cohostId] = { allowDelete: allowEndCall };

  // Sync to participantIds array in call metadata just in case
  if (Array.isArray(meta.participantIds)) {
    if (!meta.participantIds.includes(cohostId)) {
      meta.participantIds.push(cohostId);
    }
  }

  // Physially add read permission only
  const permissions = new Set(call.$permissions || []);
  permissions.add(`read("user:${cohostId}")`);

  const updatedCall = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
      data: {
      metadata: JSON.stringify(meta),
    },
      permissions: Array.from(permissions),
    });

  // Polyfill to polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const existing = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', callId),
        Query.equal('resourceType', 'call'),
        Query.equal('userId', cohostId),
        Query.limit(1),
      ] as any,
    });

    const permission = allowEndCall ? 'admin' : 'write';

    if (existing.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existing.rows[0].$id,
        data: {
          permission,
          invitedAt: existing.rows[0].invitedAt || new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'cohost',
        },
      });
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: callId,
          resourceType: 'call',
          userId: cohostId,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'cohost',
        },
      });
    }
  } catch (err) {
    console.error('[Cohost secure action] Polymorphic write failed:', err);
  }

  return JSON.parse(JSON.stringify(updatedCall));
}

export async function endCallSecureAction(callId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  if (!isAllowed) {
    // A. Check polymorphic Collaborators table
    try {
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.rows.length > 0) {
        const collab = collabsRes.rows[0];
        if (collab.permission === 'admin' && collab.role === 'cohost') {
          isAllowed = true;
        }
      }
    } catch (err) {
      console.error('[endCallSecureAction] Polymorphic query failed:', err);
    }
  }

  if (!isAllowed) {
    let meta: any = {};
    try {
      meta = JSON.parse(call.metadata || '{}');
    } catch {}
    const cohosts = meta.cohosts || {};
    const cohostSettings = cohosts[actor.$id];
    if (cohostSettings && cohostSettings.allowDelete) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to end this call');
  }

  try {
    await executeCascadeDeleteSecure(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      callId
    );
  } catch (err: any) {
    console.error('endCallSecureAction cascade cleanup failed:', err);
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  return JSON.parse(JSON.stringify(result));
}

export async function updateCallMetadataSecureAction(callId: string, extraMetadata: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
    });

  const ownerId = String(call.userId || '').trim();
  let isAllowed = (ownerId === actor.$id);

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  if (!isAllowed) {
    try {
      const collabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', callId),
          Query.equal('resourceType', 'call'),
          Query.equal('userId', actor.$id),
          Query.limit(1),
        ] as any,
      });
      if (collabsRes.rows.length > 0 && collabsRes.rows[0].role === 'cohost') {
        isAllowed = true;
      }
    } catch (err) {
      console.error('[updateCallSecureAction] Polymorphic query failed:', err);
    }
  }

  if (!isAllowed) {
    let meta: any = {};
    try {
      meta = JSON.parse(call.metadata || '{}');
    } catch {}
    const cohosts = meta.cohosts || {};
    if (cohosts[actor.$id]) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this call');
  }

  let currentMeta: any = {};
  try {
    currentMeta = JSON.parse(call.metadata || '{}');
  } catch {}

  const mergedMeta = {
    ...currentMeta,
    ...extraMetadata,
  };

  const updatedCall = await tables.updateRow({

      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
      data: {
      metadata: JSON.stringify(mergedMeta),
    },
    });

  return JSON.parse(JSON.stringify(updatedCall));
}

export async function createCallSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const now = new Date().toISOString();

  const permissions = [];
  if (data.allowGuests) {
    permissions.push(Permission.read(Role.user(actor.$id)));
  } else {
    permissions.push(Permission.read(Role.user(actor.$id)));
  }
  permissions.push(`read("user:${actor.$id}")`);
  permissions.push(`update("user:${actor.$id}")`);
  permissions.push(`delete("user:${actor.$id}")`);

  const payload = {
    userId: actor.$id,
    type: data.type || 'video',
    expiresAt: data.expiresAt || new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    startsAt: data.startsAt || now,
    title: data.title || undefined,
    metadata: data.metadata || undefined,
    conversationId: data.conversationId || undefined,
  };

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    rowId: ID.unique(),
    data: payload,
    permissions,
  });

  return JSON.parse(JSON.stringify(result));
}
