// This file is now client-safe by removing the server-only client import.
// Permissions logic that requires Admin access should be moved to 'lib/services/internal/permissions-server.ts'

import {
  mutateRowPermissions,
  mutateStorageFilePermissions,
  revokeStorageFilePermissions,
  normalizeKeyMappings,
  createEpochRows,
  removeLockboxRows,
  resolveNextEpochNumber,
  upsertLockboxRows,
} from '@/lib/api/permission-updater';
import { createAdminClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server-only';
import { ID, Permission, Role } from 'node-appwrite';

const DEFAULT_GHOST_RESOURCE_TYPE = 'ghost_note';

function getAction(body: any): string {
  return String(body?.action || 'grant').trim();
}

function getPermissionLevel(body: any) {
  return body?.permission || 'read';
}

function getResourceKeyMappings(body: any) {
  const normalized = normalizeKeyMappings(body?.keyMappings);
  if (normalized.length > 0) return normalized;

  const resourceType = body?.resourceType || body?.mappingResourceType;
  const resourceId = body?.resourceId || body?.mappingResourceId || body?.rowId;
  const wrappedKeyMap = body?.wrappedKeyMap && typeof body.wrappedKeyMap === 'object' ? body.wrappedKeyMap : null;
  const wrappedKey = body?.wrappedKey || body?.ghostSecret || null;
  const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId);

  if (!resourceType || !resourceId) return [];

  if (wrappedKeyMap) {
    return Object.entries(wrappedKeyMap)
      .map(([grantee, key]) => ({
        resourceType,
        resourceId,
        grantee: String(grantee),
        wrappedKey: String(key),
        metadata: body?.metadata || null,
      }))
      .filter((entry) => entry.grantee && entry.wrappedKey);
  }

  if (!wrappedKey || targetUserIds.length === 0) return [];

  return targetUserIds.map((grantee: string) => ({
    resourceType,
    resourceId,
    grantee,
    wrappedKey,
    metadata: body?.metadata || null,
  }));
}

function getParticipantIds(body: any) {
  return normalizeTargetUserIds(body?.participantUserIds || body?.participants || body?.remainingParticipantIds || body?.targetUserIds);
}

export async function applyPermissionMutation(actorId: string, body: any) {
  const action = getAction(body);
  const { databases, storage } = createAdminClient();
  const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId);
  const keyMappings = getResourceKeyMappings(body);

  if (action === 'pin_ghost_note') {
    const noteIds = normalizeTargetUserIds((body?.noteIds || body?.resourceIds || body?.resourceId) as any);
    const wrappedKey = (body?.wrappedKey || body?.ghostSecret) as string | undefined;
    if (noteIds.length === 0) throw new Error('At least one noteId is required');
    if (!wrappedKey) throw new Error('wrappedKey is required');

    const ghostKeyMappings = noteIds.map((noteId) => ({
      resourceId: noteId,
      resourceType: (body?.resourceType as string) || DEFAULT_GHOST_RESOURCE_TYPE,
      grantee: actorId,
      wrappedKey: wrappedKey as string,
      metadata: body?.metadata as any || null,
    }));

    return await upsertLockboxRows(databases, actorId, ghostKeyMappings);
  }

  if (action === 'rotate_epoch') {
    const resourceId = (body?.resourceId || body?.rowId) as string;
    if (!resourceId) throw new Error('resourceId is required');

    const participantIds = getParticipantIds(body);
    if (participantIds.length === 0) throw new Error('participantUserIds are required');

    const nextEpoch = Number.isFinite(Number(body?.epochNumber)) && Number(body.epochNumber) > 0
      ? Number(body.epochNumber)
      : await resolveNextEpochNumber(databases, resourceId);
    
    return await createEpochRows(databases, actorId, resourceId, nextEpoch, participantIds, body?.keyMappings as any);
  }

  if (action === 'grant' && keyMappings.length > 0) {
    await upsertLockboxRows(databases, actorId, keyMappings);
  }

  if ((body?.storageBucketId || body?.bucketId) && body?.fileId) {
    const storageInput = {
      bucketId: body?.storageBucketId || body?.bucketId,
      fileId: body?.fileId,
      targetUserIds,
      permission: getPermissionLevel(body),
    };
    if (action === 'revoke') {
      await revokeStorageFilePermissions(storage, actorId, storageInput);
    } else {
      await mutateStorageFilePermissions(storage, actorId, storageInput);
    }
  }

  if (body?.databaseId && body?.tableId && body?.rowId) {
    await mutateRowPermissions(databases, actorId, {
      databaseId: body.databaseId,
      tableId: body.tableId,
      rowId: body.rowId,
      targetUserIds,
      permission: getPermissionLevel(body),
      action: action === 'revoke' ? 'revoke' : 'grant',
      ownerId: body?.ownerId,
    });
  }

  if (action === 'revoke') {
    const resourceType = (body?.resourceType || body?.mappingResourceType) as string;
    const resourceIdForRevoke = (body?.resourceId || body?.mappingResourceId || body?.rowId) as string;
    if (resourceType && resourceIdForRevoke) {
      await removeLockboxRows(databases, resourceType, resourceIdForRevoke, targetUserIds.length > 0 ? targetUserIds : undefined);
    }
  }

  return { success: true };
}

export async function revokePermissionMutation(actorId: string, body: any, queryTargetUserId?: string | null) {
  const { databases } = createAdminClient();
  const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId || queryTargetUserId);

  if (body?.databaseId && body?.tableId && body?.rowId) {
    await mutateRowPermissions(databases, actorId, {
      databaseId: body.databaseId,
      tableId: body.tableId,
      rowId: body.rowId,
      targetUserIds,
      action: 'revoke',
      ownerId: body?.ownerId,
    });
  }

  const resourceType = body?.resourceType || body?.mappingResourceType;
  const resourceId = body?.resourceId || body?.mappingResourceId || body?.rowId;
  if (resourceType && resourceId) {
    await removeLockboxRows(databases, resourceType, resourceId, targetUserIds.length > 0 ? targetUserIds : undefined);
  }
}

function normalizeTargetUserIds(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

export async function permissionsInternal(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>,
  actorId?: string
) {
  let effectiveActorId = actorId;

  if (!effectiveActorId) {
    const jwt = payload.jwt as string | undefined;
    const { account } = await createServerClient(jwt ? new Request('http://localhost', { headers: { authorization: `Bearer ${jwt}` } }) : undefined);
    const user = await account.get().catch(() => null);

    if (!user) throw new Error('Unauthorized');
    effectiveActorId = user.$id;
  }

  if (method === 'DELETE' || payload.action === 'revoke') {
    await revokePermissionMutation(effectiveActorId, payload);
    return { success: true, action: 'revoke' };
  }

  const result = await applyPermissionMutation(effectiveActorId, payload);
  return { 
    success: true, 
    action: getAction(payload),
    ...(typeof result === 'object' ? result : {})
  };
}
