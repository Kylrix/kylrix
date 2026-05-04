import { NextRequest } from 'next/server';
import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type PermissionLevel = 'read' | 'write' | 'admin';
export type PermissionAction = 'grant' | 'revoke' | 'rotate_epoch' | 'pin_ghost_note';

export interface PermissionMutationInput {
  databaseId?: string;
  tableId?: string;
  rowId?: string;
  ownerId?: string;
  targetUserIds?: string[] | string;
  permission?: PermissionLevel;
  action?: PermissionAction;
}

export interface KeyMappingInput {
  resourceId: string;
  resourceType: string;
  grantee: string;
  wrappedKey: string;
  metadata?: string | Record<string, unknown> | null;
}

export interface StorageFilePermissionInput {
  bucketId: string;
  fileId: string;
  targetUserIds?: string[] | string;
  permission?: PermissionLevel;
}

const PASSWORD_MANAGER_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const KEY_MAPPING_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING;
const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
const EPOCHS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.EPOCHS;

function makeKeyMappingDocumentId(resourceType: string, resourceId: string, grantee: string) {
  return createHash('sha256')
    .update(`${resourceType}:${resourceId}:${grantee}`)
    .digest('base64url')
    .slice(0, 32);
}

export function getCorsHeaders(req: NextRequest) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.split(' ')[1];
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || APPWRITE_CONFIG.ENDPOINT)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT || APPWRITE_CONFIG.PROJECT_ID)
      .setJWT(jwt);

    try {
      const account = new Account(client);
      return await account.get();
    } catch (error) {
      console.error('[Permission Updater] JWT verification failed:', error);
    }
  }

  const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${process.env.APPWRITE_ENDPOINT || APPWRITE_CONFIG.ENDPOINT}/account`, {
      method: 'GET',
      headers: {
        'X-Appwrite-Project': process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT || APPWRITE_CONFIG.PROJECT_ID,
        Cookie: cookieHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' && data.$id ? data : null;
  } catch (error) {
    console.error('[Permission Updater] Cookie verification failed:', error);
    return null;
  }
}

export function normalizeTargetUserIds(input: PermissionMutationInput['targetUserIds']) {
  if (!input) return [];
  const ids = Array.isArray(input) ? input : [input];
  return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
}

export function normalizeKeyMappings(input?: KeyMappingInput[] | KeyMappingInput | null) {
  if (!input) return [];
  const mappings = Array.isArray(input) ? input : [input];
  return mappings
    .map((mapping) => ({
      resourceId: String(mapping.resourceId || '').trim(),
      resourceType: String(mapping.resourceType || '').trim(),
      grantee: String(mapping.grantee || '').trim(),
      wrappedKey: String(mapping.wrappedKey || '').trim(),
      metadata:
        typeof mapping.metadata === 'string'
          ? mapping.metadata
          : mapping.metadata
            ? JSON.stringify(mapping.metadata)
            : null,
    }))
    .filter((mapping) => mapping.resourceId && mapping.resourceType && mapping.grantee && mapping.wrappedKey);
}

function buildRecipientPermissions(userId: string, permission: PermissionLevel) {
  const grants = [Permission.read(Role.user(userId))];

  if (permission === 'write' || permission === 'admin') {
    grants.push(Permission.update(Role.user(userId)));
  }

  if (permission === 'admin') {
    grants.push(Permission.delete(Role.user(userId)));
  }

  return grants;
}

function buildOwnerPermissions(ownerId: string) {
  return [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
  ];
}

function buildStoragePermissions(targetUserIds: string[], permission: PermissionLevel) {
  const grants = new Set<string>();
  for (const userId of targetUserIds) {
    for (const grant of buildRecipientPermissions(userId, permission)) {
      grants.add(grant);
    }
  }
  return Array.from(grants);
}

async function upsertKeyMapping(databases: Databases, actorId: string, mapping: KeyMappingInput) {
  const normalized = normalizeKeyMappings(mapping)[0];
  if (!normalized) {
    throw new Error('resourceId, resourceType, grantee, and wrappedKey are required');
  }

  const documentId = makeKeyMappingDocumentId(normalized.resourceType, normalized.resourceId, normalized.grantee);

  const payload = {
    resourceId: normalized.resourceId,
    resourceType: normalized.resourceType,
    grantee: normalized.grantee,
    wrappedKey: normalized.wrappedKey,
    metadata: normalized.metadata,
  };

  const permissions = [
    Permission.read(Role.user(normalized.grantee)),
    Permission.update(Role.user(actorId)),
    Permission.delete(Role.user(actorId)),
  ];

  try {
    return await databases.createDocument(
      PASSWORD_MANAGER_DB,
      KEY_MAPPING_TABLE,
      documentId,
      payload,
      permissions,
    );
  } catch (error: any) {
    if (error?.code !== 409) {
      throw error;
    }

    return await databases.updateDocument(
      PASSWORD_MANAGER_DB,
      KEY_MAPPING_TABLE,
      documentId,
      payload,
      permissions,
    );
  }
}

async function deleteKeyMappings(
  databases: Databases,
  resourceType: string,
  resourceId: string,
  grantees?: string[],
) {
  const queries = [
    Query.equal('resourceType', resourceType),
    Query.equal('resourceId', resourceId),
  ];

  const normalizedGrantees = Array.from(new Set((grantees || []).map((value) => String(value).trim()).filter(Boolean)));
  if (normalizedGrantees.length > 0) {
    queries.push(Query.equal('grantee', normalizedGrantees));
  }

  const existing = await databases.listDocuments(PASSWORD_MANAGER_DB, KEY_MAPPING_TABLE, [...queries, Query.limit(1000)]);
  if (existing.documents.length === 0) return [];

  await Promise.all(
    existing.documents.map((row) => databases.deleteDocument(PASSWORD_MANAGER_DB, KEY_MAPPING_TABLE, row.$id)),
  );

  return existing.documents;
}

async function createEpoch(
  databases: Databases,
  actorId: string,
  resourceId: string,
  epochNumber: number,
  participantIds: string[] = [],
) {
  const uniqueParticipants = Array.from(new Set(participantIds.map((value) => String(value).trim()).filter(Boolean)));
  const permissions = [
    Permission.read(Role.user(actorId)),
    Permission.update(Role.user(actorId)),
    Permission.delete(Role.user(actorId)),
    ...uniqueParticipants.map((participantId) => Permission.read(Role.user(participantId))),
  ];

  return await databases.createDocument(
    CHAT_DB,
    EPOCHS_TABLE,
    ID.unique(),
    {
      resourceId,
      epochNumber,
      createdBy: actorId,
    },
    permissions,
  );
}

export async function resolveNextEpochNumber(databases: Databases, resourceId: string) {
  const existing = await databases.listDocuments(CHAT_DB, EPOCHS_TABLE, [
    Query.equal('resourceId', resourceId),
    Query.orderDesc('epochNumber'),
    Query.limit(1),
  ]);

  const latest = existing.documents[0];
  const latestNumber = Number(latest?.epochNumber || 0);
  return Number.isFinite(latestNumber) && latestNumber > 0 ? latestNumber + 1 : 1;
}

export async function mutateStorageFilePermissions(
  storage: Storage,
  actorId: string,
  input: StorageFilePermissionInput,
) {
  const bucketId = String(input.bucketId || '').trim();
  const fileId = String(input.fileId || '').trim();
  const targetUserIds = normalizeTargetUserIds(input.targetUserIds).filter((userId) => userId !== actorId);
  const permission = input.permission || 'read';

  if (!bucketId || !fileId) {
    throw new Error('bucketId and fileId are required');
  }

  const file = await storage.getFile(bucketId, fileId);
  const existingPermissions = new Set(Array.isArray(file?.$permissions) ? file.$permissions : []);
  const desiredGrants = buildStoragePermissions(targetUserIds, permission);

  for (const grant of desiredGrants) {
    existingPermissions.add(grant);
  }

  return await storage.updateFile(bucketId, fileId, undefined, Array.from(existingPermissions));
}

export async function revokeStorageFilePermissions(
  storage: Storage,
  actorId: string,
  input: StorageFilePermissionInput,
) {
  const bucketId = String(input.bucketId || '').trim();
  const fileId = String(input.fileId || '').trim();
  const targetUserIds = normalizeTargetUserIds(input.targetUserIds).filter((userId) => userId !== actorId);

  if (!bucketId || !fileId) {
    throw new Error('bucketId and fileId are required');
  }

  const file = await storage.getFile(bucketId, fileId);
  const currentPermissions = new Set(Array.isArray(file?.$permissions) ? file.$permissions : []);
  const removalTokens = targetUserIds.flatMap((userId) => [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);

  for (const token of removalTokens) {
    currentPermissions.delete(token);
  }

  return await storage.updateFile(bucketId, fileId, undefined, Array.from(currentPermissions));
}

export async function mutateRowPermissions(
  databases: Databases,
  actorId: string,
  input: PermissionMutationInput,
) {
  const action = input.action || 'grant';
  const permission = input.permission || 'read';
  const targetUserIds = normalizeTargetUserIds(input.targetUserIds).filter((userId) => userId !== actorId);
  const ownerId = input.ownerId || actorId;

  if (!input.databaseId || !input.tableId || !input.rowId) {
    throw new Error('databaseId, tableId, and rowId are required');
  }

  if (action === 'grant' && targetUserIds.length === 0) {
    throw new Error('At least one targetUserId is required');
  }

  let nextPermissions = buildOwnerPermissions(ownerId);

  if (action === 'grant') {
    for (const userId of targetUserIds) {
      nextPermissions.push(...buildRecipientPermissions(userId, permission));
    }
  } else {
    nextPermissions = buildOwnerPermissions(ownerId);
  }

  const dedupedPermissions = Array.from(new Set(nextPermissions));

  const updated = await databases.updateDocument(
    input.databaseId,
    input.tableId,
    input.rowId,
    {},
    dedupedPermissions,
  );

  return {
    row: updated,
    permissions: dedupedPermissions,
  };
}

export async function upsertLockboxRows(
  databases: Databases,
  actorId: string,
  keyMappings?: KeyMappingInput[] | KeyMappingInput | null,
) {
  const mappings = normalizeKeyMappings(keyMappings);
  if (mappings.length === 0) return [];
  return Promise.all(mappings.map((mapping) => upsertKeyMapping(databases, actorId, mapping)));
}

export async function removeLockboxRows(
  databases: Databases,
  resourceType: string,
  resourceId: string,
  grantees?: string[],
) {
  return deleteKeyMappings(databases, resourceType, resourceId, grantees);
}

export async function createEpochRows(
  databases: Databases,
  actorId: string,
  resourceId: string,
  epochNumber: number,
  participantIds: string[] = [],
  keyMappings?: KeyMappingInput[] | KeyMappingInput | null,
) {
  const epoch = await createEpoch(databases, actorId, resourceId, epochNumber, participantIds);
  const mappings = normalizeKeyMappings(keyMappings).map((mapping) => ({
    ...mapping,
    resourceId: epoch.$id,
    resourceType: 'epoch',
  }));
  if (mappings.length === 0) return { epoch, keyMappings: [] };

  const rows = await Promise.all(mappings.map((mapping) => upsertKeyMapping(databases, actorId, mapping)));
  return { epoch, keyMappings: rows };
}
