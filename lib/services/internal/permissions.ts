import { createAdminClient } from '@/lib/appwrite-admin';
import {
  createEpochRows,
  mutateRowPermissions,
  mutateStorageFilePermissions,
  normalizeKeyMappings,
  normalizeTargetUserIds,
  removeLockboxRows,
  resolveNextEpochNumber,
  revokeStorageFilePermissions,
  upsertLockboxRows,
} from '@/lib/api/permission-updater';

export async function applyPermissionMutation(actorId: string, body: any) {
  const action = String(body?.action || 'grant').trim();
  const { databases, storage } = createAdminClient();
  const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId);
  const keyMappings = normalizeKeyMappings(body?.keyMappings);

  if (action === 'rotate_epoch') {
    const resourceId = body?.resourceId || body?.rowId;
    if (!resourceId) throw new Error('resourceId is required');
    const participantIds = normalizeTargetUserIds(body?.participantUserIds || body?.participants || body?.remainingParticipantIds || body?.targetUserIds);
    if (participantIds.length === 0) throw new Error('participantUserIds are required');
    const nextEpoch = Number.isFinite(Number(body?.epochNumber)) && Number(body?.epochNumber) > 0
      ? Number(body.epochNumber)
      : await resolveNextEpochNumber(databases, resourceId);
    return createEpochRows(databases, actorId, resourceId, nextEpoch, participantIds, body?.keyMappings);
  }

  if (action === 'grant' && keyMappings.length > 0) {
    await upsertLockboxRows(databases, actorId, keyMappings);
  }

  if ((body?.storageBucketId || body?.bucketId) && body?.fileId) {
    const storageInput = {
      bucketId: body?.storageBucketId || body?.bucketId,
      fileId: body?.fileId,
      targetUserIds,
      permission: body?.permission || 'read',
    };
    if (action === 'revoke') {
      await revokeStorageFilePermissions(storage, actorId, storageInput);
    } else {
      await mutateStorageFilePermissions(storage, actorId, storageInput);
    }
  }

  if (body?.databaseId && body?.tableId && body?.rowId) {
    return mutateRowPermissions(databases, actorId, {
      databaseId: body.databaseId,
      tableId: body.tableId,
      rowId: body.rowId,
      targetUserIds,
      permission: body?.permission || 'read',
      action: action === 'revoke' ? 'revoke' : 'grant',
      ownerId: body?.ownerId,
    });
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
