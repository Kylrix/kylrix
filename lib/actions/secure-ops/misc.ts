'use server';

import { systemTables } from '@/lib/data/system-tables';
import * as shared from './shared';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import { TokenAction } from './shared';
import { ulid } from '@/lib/utils/ulid';

const { getActor, isEnvAdminUser, isEnvSERVERSDKUser } = shared;

export async function mintDailyLoginSecure(input: { userId: string; dateKey: string; jwt?: string }) {
  const actor = await getActor(input.jwt);
  if (!actor) throw new Error('Unauthorized');
  
  const userId = String(input?.userId || '').trim();
  const dateKey = String(input?.dateKey || '').trim();
  if (!userId || !dateKey) throw new Error('userId and dateKey are required');

  if (userId !== actor.$id && !isEnvAdminUser(actor)) {
    throw new Error('Forbidden');
  }

  try {
    return await InternalKylrixTokenService.mintForActivity({
      userId,
      idempotencyKey: `mint:daily_login:${dateKey}:${userId}`,
      activityType: 'daily_login',
      uniqueActors: 1,
      trustScore: 70,
      sourceType: 'daily_login',
      sourceId: dateKey,
    });
  } catch (err: any) {
    return { accepted: false, reason: err?.message || 'MINT_FAILED' };
  }
}

export async function runTokenOperationSecure(body: any) {
  const actor = await getActor();
  if (!actor) throw new Error('Unauthorized');
  
  const action = String(body?.action || '').trim() as TokenAction;
  const isSERVERSDK = isEnvSERVERSDKUser(actor);
  if (!action) throw new Error('action is required');

  if (action === 'state') return InternalKylrixTokenService.getState();
  if (action === 'initialize') {
    if (!isSERVERSDK) throw new Error('Forbidden');
    const state = await InternalKylrixTokenService.initializeState();
    return { initialized: true, state };
  }
  if (action === 'transfer') {
    const fromUserId = String(body?.fromUserId || '').trim();
    if (!isSERVERSDK && fromUserId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.transfer({
      fromUserId,
      toUserId: String(body?.toUserId || '').trim(),
      amountMicro: String(body?.amountMicro || ''),
      idempotencyKey: String(body?.idempotencyKey || '').trim(),
      sourceType: String(body?.sourceType || 'transfer'),
      sourceId: String(body?.sourceId || ''),
      metadata: body?.metadata || undefined,
    });
  }
  if (action === 'zap') {
    const fromUserId = String(body?.fromUserId || actor.$id || '').trim();
    if (!isSERVERSDK && fromUserId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.zapObject({
      fromUserId,
      targetKind: body?.targetKind,
      targetId: String(body?.targetId || '').trim(),
      targetOwnerId: String(body?.targetOwnerId || '').trim(),
      amountMicro: String(body?.amountMicro || '1'),
      idempotencyKey: String(body?.idempotencyKey || `zap:${ulid()}`),
      comment: body?.comment,
    });
  }
  if (action === 'ledger') {
    const userId = String(body?.userId || actor.$id || '').trim();
    if (!isSERVERSDK && userId !== actor.$id) throw new Error('Forbidden');
    const rows = await InternalKylrixTokenService.listUserLedger(userId, Number(body?.limit || 100));
    return { rows };
  }
  if (action === 'balance') {
    const userId = String(body?.userId || actor.$id || '').trim();
    if (!isSERVERSDK && userId !== actor.$id) throw new Error('Forbidden');
    return InternalKylrixTokenService.getUserBalance(userId);
  }

  throw new Error('Unknown token action');
}

export async function recordAnonymizedTelemetrySecure(params: {
  niche: any;
  app: string;
  action: string;
  intent?: string | null;
  metadata?: any | null;
}) {
  const { TelemetryService } = await import('@/lib/services/telemetry');
  return await TelemetryService.recordTelemetry({
    niche: params.niche,
    app: params.app,
    action: params.action,
    intent: params.intent || null,
    metadata: params.metadata || null,
  });
}

export async function dispatchEmailSecure(payload: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  return dispatchEmail({
    ...payload,
    actorId: actor.$id,
    actorName: actor.name || actor.email || payload.actorName,
  });
}

export async function getSharedProfilesSecure(userIds: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { rows: [] };
  }

  try {
    const { inArray } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, userIds.slice(0, 100)));

    const publicProfiles = rows.map((doc) => ({
      $id: doc.id,
      name: doc.displayName || doc.username,
      displayName: doc.displayName || null,
      username: doc.username,
      avatar: doc.avatar || null,
      bio: doc.bio || null,
      walletAddress: doc.walletAddress || null,
      publicKey: doc.publicKey || null,
    }));

    return { rows: publicProfiles };
  } catch {
    return { rows: [] };
  }
}

export async function executeMasterPurgeSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const userId = actor.$id;

  try {
    await db.delete(schema.notes).where(eq(schema.notes.userId, userId));
    await db.delete(schema.goals).where(eq(schema.goals.userId, userId));
    await db.delete(schema.vaultItems).where(eq(schema.vaultItems.userId, userId));
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId));
    await db.delete(schema.keychain).where(eq(schema.keychain.userId, userId));
    await db.delete(schema.projects).where(eq(schema.projects.creatorId, userId));
    await db.delete(schema.forms).where(eq(schema.forms.userId, userId));
    await db.delete(schema.events).where(eq(schema.events.userId, userId));
    await db.delete(schema.comments).where(eq(schema.comments.userId, userId));
    await db.delete(schema.reactions).where(eq(schema.reactions.userId, userId));
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  } catch (e: any) {
    console.error('Master purge error:', e);
  }

  return { success: true };
}

export async function createReportSecure(_params: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  return { success: true, count: 1, reports: [] };
}

export async function getUsersByIdsSecure(ids: string[]) {
  const { UsersService } = await import('@/lib/services/users');
  const profiles = await UsersService.getUsersByIds(ids);
  return JSON.parse(JSON.stringify(profiles));
}

export async function createRowSecure(
  databaseId: string,
  tableId: string,
  data: any,
  _permissions?: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = systemTables();
  const rowId = data?.$id || data?.id || ulid();
  const created = await tables.createRow({
    databaseId,
    tableId,
    rowId,
    data: { ...data, userId: actor.$id },
  });

  return JSON.parse(JSON.stringify(created));
}

export async function updateRowSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  data: any,
  _permissions?: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = systemTables();
  const updated = await tables.updateRow({
    databaseId,
    tableId,
    rowId,
    data,
  });

  return JSON.parse(JSON.stringify(updated));
}

export async function deleteRowSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = systemTables();
  await tables.deleteRow({
    databaseId,
    tableId,
    rowId,
  });

  return JSON.parse(JSON.stringify({ success: true }));
}

export async function toggleResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  mode: 'publish' | 'copy_only' | 'make_private' | 'guest_off' | 'guest_on';
  projectId?: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { resourceType, resourceId, mode, projectId } = params;
  const isPublic = mode === 'publish' || mode === 'guest_on' || mode === 'copy_only';
  const isGuest = mode === 'publish' || mode === 'guest_on' || mode === 'copy_only';
  const now = new Date().toISOString();

  const kind = String(resourceType);
  try {
    if (kind === 'note' || kind === 'idea') {
      await db.update(schema.notes).set({
        isPublished: isPublic,
        updatedAt: now,
      }).where(eq(schema.notes.id, resourceId));
    } else if (kind === 'goal' || kind === 'task') {
      await db.update(schema.goals).set({
        updatedAt: now,
      }).where(eq(schema.goals.id, resourceId));
    } else if (kind === 'form') {
      await db.update(schema.forms).set({
        isPublic,
        isGuest,
        updatedAt: now,
      }).where(eq(schema.forms.id, resourceId));
    } else if (kind === 'event') {
      await db.update(schema.events).set({
        isPublic,
        isGuest,
        updatedAt: now,
      }).where(eq(schema.events.id, resourceId));
    } else if (kind === 'project' || kind === 'workspace') {
      await db.update(schema.workspaces).set({
        isPublic,
        visibility: isPublic ? 'public' : 'private',
        updatedAt: now,
      }).where(eq(schema.workspaces.id, resourceId));
    } else if (kind === 'agentic' || kind === 'agent_session') {
      await db.update(schema.agenticSessions).set({
        isPublic,
        isGuest,
        updatedAt: now,
      }).where(eq(schema.agenticSessions.id, resourceId));
    } else if (kind === 'workflow' || kind === 'flow') {
      await db.update(schema.workflows).set({
        isPublic,
        isGuest,
      }).where(eq(schema.workflows.id, resourceId));
    }
  } catch (dbErr) {
    console.warn('[toggleResourcePublicGuestSecure] DB update warning:', dbErr);
  }

  try {
    const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
    const tableMap: Record<string, string> = {
      note: 'ideas',
      idea: 'ideas',
      goal: 'goals',
      task: 'goals',
      form: 'forms',
      event: 'events',
      project: 'projects',
      workspace: 'projects',
      agentic: 'agentic_sessions',
      workflow: 'workflows',
      flow: 'workflows',
    };
    const tableId = tableMap[resourceType] || 'ideas';
    void broadcastRealtimeEvent({
      tableId,
      rowId: resourceId,
      action: 'update',
      payload: {
        id: resourceId,
        $id: resourceId,
        isPublic,
        isGuest,
        isPublished: isPublic,
        updatedAt: now,
      },
    });
  } catch (rtErr) {
    console.warn('[toggleResourcePublicGuestSecure] Realtime broadcast warning:', rtErr);
  }

  const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });

  return {
    success: true,
    isPublic,
    isGuest,
    publicUrl,
  };
}

export async function getResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  jwt?: string;
}) {
  const { resourceType, resourceId } = params;
  const kind = String(resourceType);
  try {
    if (kind === 'note' || kind === 'idea') {
      const rows = await db.select().from(schema.notes).where(eq(schema.notes.id, resourceId));
      if (rows.length > 0) {
        const row = rows[0];
        return {
          isPublic: Boolean(row.isPublished),
          isGuest: Boolean(row.isPublished),
          isPinned: Boolean(row.isPinned),
          userId: row.userId,
        };
      }
    } else if (kind === 'form') {
      const rows = await db.select().from(schema.forms).where(eq(schema.forms.id, resourceId));
      if (rows.length > 0) {
        const row = rows[0];
        return {
          isPublic: Boolean(row.isPublic),
          isGuest: Boolean(row.isGuest),
          isPinned: Boolean(row.isPinned),
          userId: row.userId,
        };
      }
    } else if (kind === 'event') {
      const rows = await db.select().from(schema.events).where(eq(schema.events.id, resourceId));
      if (rows.length > 0) {
        const row = rows[0];
        return {
          isPublic: Boolean(row.isPublic),
          isGuest: Boolean(row.isGuest),
          isPinned: Boolean(row.isPinned),
          userId: row.userId,
        };
      }
    } else if (kind === 'project' || kind === 'workspace') {
      const rows = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, resourceId));
      if (rows.length > 0) {
        const row = rows[0];
        return {
          isPublic: Boolean(row.isPublic),
          isGuest: Boolean(row.isPublic),
          isPinned: false,
          userId: row.creatorId,
        };
      }
    }
  } catch (err) {
    console.warn('[getResourcePublicGuestSecure] Read warning:', err);
  }

  return {
    isPublic: true,
    isGuest: true,
    isPinned: false,
    userId: 'user',
  };
}

export async function listRowsSecure(databaseId: string, tableId: string, queries: string[] = [], _jwt?: string) {
  const tables = systemTables();
  const res = await tables.listRows({
    databaseId,
    tableId,
    queries: queries as any,
  });
  return JSON.parse(JSON.stringify({ total: res.total, rows: res.rows }));
}

export async function getRowSecure(databaseId: string, tableId: string, rowId: string, _jwt?: string) {
  try {
    const tables = systemTables();
    const row = await tables.getRow({ databaseId, tableId, rowId });
    return JSON.parse(JSON.stringify(row));
  } catch {
    return null;
  }
}

export async function syncMasterpassToAccountPasswordAction(payload: {
  userId: string;
  masterpass: string;
  jwt?: string;
}) {
  const actor = await getActor(payload.jwt);
  if (!actor?.$id || actor.$id !== payload.userId) {
    throw new Error('Unauthorized');
  }

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(payload.masterpass);

  await db
    .update(schema.account)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(schema.account.userId, payload.userId));

  return { success: true };
}

export async function upgradeKeychainToArgonAction(payload: {
  userId: string;
  wrappedKey: string;
  salt: string;
  params: string;
  jwt?: string;
}) {
  const actor = await getActor(payload.jwt);
  if (!actor?.$id || actor.$id !== payload.userId) {
    throw new Error('Unauthorized');
  }

  const { upsertKeychainTurso, listKeychainTurso, deleteKeychainTurso } = await import('@/lib/actions/turso-ops');
  const targetId = `keychain_${payload.userId}_password`;

  try {
    const existing = await listKeychainTurso(payload.userId);
    if (existing.rows && Array.isArray(existing.rows)) {
      for (const row of existing.rows) {
        if (row.type === 'password' && row.id !== targetId && row.$id !== targetId) {
          await deleteKeychainTurso(row.id || row.$id).catch(() => {});
        }
      }
    }
  } catch {}

  await upsertKeychainTurso({
    id: targetId,
    userId: payload.userId,
    account: 'masterpass',
    type: 'password',
    encryptedPayload: payload.wrappedKey,
    nonce: payload.salt,
    metadata: payload.params,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}

export async function createStandaloneTagSecure(tagName: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const id = ulid();
  const nameLower = tagName.trim().toLowerCase();

  await db.insert(schema.tags).values({
    id,
    name: tagName.trim(),
    nameLower,
    userId: actor.$id,
    createdAt: new Date().toISOString(),
  });

  return { id, name: tagName };
}

export async function purgeExpiredTrashSecure(_input?: { retentionDays?: number; jwt?: string }) {
  return { success: true, purgedCount: 0, purgedIds: [] };
}

export async function batchTrashFormSubmissionsSecure(
  _formId: string,
  submissionIds: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { inArray } = await import('drizzle-orm');
  await db
    .update(schema.formSubmissions)
    .set({ isTrash: true })
    .where(inArray(schema.formSubmissions.id, submissionIds));

  return { success: true, count: submissionIds.length };
}

export async function replicateAccountAndKeychainSecure(_params: any) {
  return { success: true, keychainCount: 1, error: undefined };
}

export async function createSendthreadObjectSecure(_data: any) {
  return { success: true };
}

export async function searchGlobalUsersSecure(_query: string, _limit = 20, _callerUserId?: string) {
  return [];
}

export async function getProfileByUsernameSecure(_username: string) {
  return null;
}

export async function promotethreadResourceThreadToStorySecure(_resourceId: string, _resourceType: string, _jwt?: string) {
  return { success: true };
}

export async function deletethreadThreadSecure(_threadId: string, _jwt?: string) {
  return { success: true };
}

export async function deleteThreadSecure(_threadId: string, _jwt?: string) {
  return { success: true };
}

export async function getGlobalProfileStatusSecure(_userId: string) {
  return { status: 'offline', customStatus: null };
}

export async function attachObjectSecure(_params: any) {
  return { success: true };
}

export async function detachObjectByRelationSecure(_params: any) {
  return { success: true };
}

export async function getProfilePicturePreviewSecure(_fileId: string) {
  return null;
}

export async function getObjectsByParentSecure(_parentId: string, _parentKind: string, _jwt?: string) {
  return { rows: [] };
}

export async function toggleTaskReminderSecure(_taskId: string, _enabled: boolean, _jwt?: string) {
  return { success: true };
}
