import { createAdminClient } from '@/lib/appwrite-admin';
import { createServerClient } from '@/lib/appwrite-server';
import {
  mutateRowPermissions,
  mutateStorageFilePermissions,
  revokeStorageFilePermissions,
  normalizeKeyMappings,
  normalizeTargetUserIds,
  createEpochRows,
  removeLockboxRows,
  resolveNextEpochNumber,
  upsertLockboxRows,
} from '@/lib/api/permission-updater';

const DEFAULT_GHOST_RESOURCE_TYPE = 'ghost_note';

function getAction(body: any): string {
  return String(body?.action || 'grant').trim();
}

function getPermissionLevel(body: any) {
  return body?.permission || 'read';
}

function getResourceKeyMappings(body: any, _userId: string) {
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

export async function permissionsInternal(
  method: 'POST' | 'DELETE',
  payload: Record<string, unknown>
) {
  const { account } = await createServerClient();
  const user = await account.get().catch(() => null);

  if (!user) throw new Error('Unauthorized');

  const action = method === 'DELETE' ? 'revoke' : getAction(payload);
  const { databases, storage } = createAdminClient();

  if (action === 'pin_ghost_note') {
    const noteIds = normalizeTargetUserIds(payload?.noteIds || payload?.resourceIds || payload?.resourceId);
    const wrappedKey = payload?.wrappedKey || payload?.ghostSecret;
    if (noteIds.length === 0) throw new Error('At least one noteId is required');
    if (!wrappedKey) throw new Error('wrappedKey is required');

    const keyMappings = noteIds.map((noteId) => ({
      resourceId: noteId,
      resourceType: (payload?.resourceType as string) || DEFAULT_GHOST_RESOURCE_TYPE,
      grantee: user.$id,
      wrappedKey: wrappedKey as string,
      metadata: payload?.metadata as any || null,
    }));

    const rows = await upsertLockboxRows(databases, user.$id, keyMappings);
    return { success: true, action, rows: JSON.parse(JSON.stringify(rows)) };
  }

  if (action === 'rotate_epoch') {
    const resourceId = (payload?.resourceId || payload?.rowId) as string;
    if (!resourceId) throw new Error('resourceId is required');

    const participantIds = getParticipantIds(payload);
    if (participantIds.length === 0) throw new Error('participantUserIds are required');

    const nextEpoch = Number.isFinite(Number(payload?.epochNumber)) && Number(payload.epochNumber) > 0
      ? Number(payload.epochNumber)
      : await resolveNextEpochNumber(databases, resourceId);
    const result = await createEpochRows(databases, user.$id, resourceId, nextEpoch, participantIds, payload?.keyMappings as any);

    return {
      success: true,
      action,
      epoch: JSON.parse(JSON.stringify(result.epoch)),
      keyMappings: JSON.parse(JSON.stringify(result.keyMappings)),
    };
  }

  const keyMappings = getResourceKeyMappings(payload, user.$id);
  const targetUserIds = normalizeTargetUserIds(payload?.targetUserIds || payload?.recipientUserIds || payload?.targetUserId);
  const storageBucketId = (payload?.storageBucketId || payload?.bucketId) as string;
  const fileId = payload?.fileId as string;
  const permission = getPermissionLevel(payload);

  let result = null;
  let storageResult = null;

  if (action === 'grant' && keyMappings.length > 0) {
    await upsertLockboxRows(databases, user.$id, keyMappings);
  }

  if (storageBucketId && fileId) {
    storageResult = action === 'revoke'
      ? await revokeStorageFilePermissions(storage, user.$id, {
        bucketId: storageBucketId,
        fileId,
        targetUserIds,
        permission,
      })
      : await mutateStorageFilePermissions(storage, user.$id, {
        bucketId: storageBucketId,
        fileId,
        targetUserIds,
        permission,
      });
  }

  const databaseId = payload?.databaseId as string;
  const tableId = payload?.tableId as string;
  const rowId = (payload?.rowId || payload?.resourceId) as string;

  if (databaseId && tableId && rowId) {
    result = await mutateRowPermissions(databases, user.$id, {
      databaseId,
      tableId,
      rowId,
      targetUserIds,
      permission: getPermissionLevel(payload),
      action: action === 'revoke' ? 'revoke' : 'grant',
    });
  }

  if (action === 'revoke') {
    const resourceType = (payload?.resourceType || payload?.mappingResourceType) as string;
    const resourceIdForRevoke = (payload?.resourceId || payload?.mappingResourceId || rowId) as string;
    if (resourceType && resourceIdForRevoke) {
      await removeLockboxRows(databases, resourceType, resourceIdForRevoke, targetUserIds.length > 0 ? targetUserIds : undefined);
    }
  }

  return {
    success: true,
    action,
    rowId,
    permissions: result?.permissions || null,
    storagePermissions: storageResult?.$permissions || null,
  };
}
