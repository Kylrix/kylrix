import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import {
  getCorsHeaders,
  mutateRowPermissions,
  mutateStorageFilePermissions,
  revokeStorageFilePermissions,
  normalizeKeyMappings,
  normalizeTargetUserIds,
  createEpochRows,
  removeLockboxRows,
  resolveNextEpochNumber,
  upsertLockboxRows,
  verifyUser,
} from '@/lib/api/permission-updater';

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

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const action = getAction(body);
    const { databases, storage } = createAdminClient();

    if (action === 'pin_ghost_note') {
      const noteIds = normalizeTargetUserIds(body?.noteIds || body?.resourceIds || body?.resourceId);
      const wrappedKey = body?.wrappedKey || body?.ghostSecret;
      if (noteIds.length === 0) {
        return NextResponse.json({ error: 'At least one noteId is required' }, { status: 400, headers: corsHeaders });
      }
      if (!wrappedKey) {
        return NextResponse.json({ error: 'wrappedKey is required' }, { status: 400, headers: corsHeaders });
      }

      const keyMappings = noteIds.map((noteId) => ({
        resourceId: noteId,
        resourceType: body?.resourceType || DEFAULT_GHOST_RESOURCE_TYPE,
        grantee: user.$id,
        wrappedKey,
        metadata: body?.metadata || null,
      }));

      const rows = await upsertLockboxRows(databases, user.$id, keyMappings);
      return NextResponse.json(
        {
          success: true,
          action,
          rows,
        },
        { headers: corsHeaders },
      );
    }

    if (action === 'rotate_epoch') {
      const resourceId = body?.resourceId || body?.rowId;
      if (!resourceId) {
        return NextResponse.json({ error: 'resourceId is required' }, { status: 400, headers: corsHeaders });
      }

      const participantIds = getParticipantIds(body);
      if (participantIds.length === 0) {
        return NextResponse.json({ error: 'participantUserIds are required' }, { status: 400, headers: corsHeaders });
      }

      const nextEpoch = Number.isFinite(Number(body?.epochNumber)) && Number(body?.epochNumber) > 0
        ? Number(body.epochNumber)
        : await resolveNextEpochNumber(databases, resourceId);
      const result = await createEpochRows(databases, user.$id, resourceId, nextEpoch, participantIds, body?.keyMappings);

      return NextResponse.json(
        {
          success: true,
          action,
          epoch: result.epoch,
          keyMappings: result.keyMappings,
        },
        { headers: corsHeaders },
      );
    }

    const keyMappings = getResourceKeyMappings(body);
    const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId);
    const storageBucketId = body?.storageBucketId || body?.bucketId;
    const fileId = body?.fileId;
    const permission = getPermissionLevel(body);

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

    const databaseId = body?.databaseId;
    const tableId = body?.tableId;
    const rowId = body?.rowId;

    if (databaseId && tableId && rowId) {
      result = await mutateRowPermissions(databases, user.$id, {
        databaseId,
        tableId,
        rowId,
        targetUserIds,
        permission: getPermissionLevel(body),
        action: action === 'revoke' ? 'revoke' : 'grant',
      });
    } else if (action === 'grant' && keyMappings.length === 0 && !databaseId && !storageBucketId) {
      return NextResponse.json({ error: 'databaseId, tableId, and rowId are required for ACL updates' }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json(
        {
          success: true,
          action,
          rowId,
          permissions: result?.permissions || null,
          storagePermissions: storageResult?.$permissions || null,
        },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to update permissions';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Permission Updater API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const queryTargetUserId = url.searchParams.get('targetUserId');
    const body = await req.json().catch(() => ({}));
    const { databases } = createAdminClient();

    const databaseId = body?.databaseId;
    const tableId = body?.tableId;
    const rowId = body?.rowId;
    const targetUserIds = normalizeTargetUserIds(body?.targetUserIds || body?.recipientUserIds || body?.targetUserId || queryTargetUserId);
    const resourceType = body?.resourceType || body?.mappingResourceType;
    const resourceId = body?.resourceId || body?.mappingResourceId || rowId;

    let result = null;
    if (databaseId && tableId && rowId) {
      result = await mutateRowPermissions(databases, user.$id, {
        databaseId,
        tableId,
        rowId,
        targetUserIds,
        action: 'revoke',
      });
    }

    if (resourceType && resourceId) {
      await removeLockboxRows(databases, resourceType, resourceId, targetUserIds.length > 0 ? targetUserIds : undefined);
    }

    return NextResponse.json(
      {
        success: true,
        action: 'revoke',
        rowId,
        permissions: result?.permissions || null,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to revoke permissions';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Permission Updater API] Delete error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
