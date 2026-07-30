import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { executeCascadeDeleteSecure } from '../cascade-delete';

// Import interfaces / types from shared

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  verifyResourcePermissionSecure} = shared;

export async function addCallCohostSecureAction(callId: string, cohostId: string, allowEndCall: boolean = false, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId});

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
      metadata: JSON.stringify(meta)},
      permissions: Array.from(permissions)});

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
      ] as any});

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
          role: 'cohost'}});
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
          role: 'cohost'}});
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
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId});

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
        ] as any});
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
      rowId: callId});

  return JSON.parse(JSON.stringify(result));
}

export async function updateCallMetadataSecureAction(callId: string, extraMetadata: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  const call = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId});

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
        ] as any});
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
    ...extraMetadata};

  const updatedCall = await tables.updateRow({

      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
      rowId: callId,
      data: {
      metadata: JSON.stringify(mergedMeta)}});

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
    data});
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
    conversationId: data.conversationId || undefined};

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
    rowId: ID.unique(),
    data: payload,
    permissions});

  return JSON.parse(JSON.stringify(result));
}
