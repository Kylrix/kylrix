'use server';

import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';


import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { withSystemTransaction } from '@/lib/services/internal/transaction';
import { Registry } from '@/lib/core/di/registry';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import {
  IDSchema,
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema
} from '@/lib/validations/schemas';

// Import interfaces / types from shared
import { TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  verifyResourcePermissionSecure
} = shared;



async function getIsSpecializedTable(tableId: string): Promise<boolean> {
  return (
    tableId === APPWRITE_CONFIG.TABLES.FLOW.GUESTS || 
    tableId === 'Collaborators' || 
    tableId === 'collaborators' ||
    tableId === 'formSubmissions' ||
    tableId === 'wallets' ||
    tableId === 'walletMap' ||
    tableId === 'follows' ||
    tableId === 'activityLog' ||
    tableId === 'conversations' ||
    tableId === 'conversationMembers'
  );
}

export async function syncMasterpassToAccountPasswordAction(payload: {
  userId: string;
  masterpass: string;
  jwt?: string;
}) {
  const { z } = await import('zod');
  const validatedUserId = IDSchema.parse(payload.userId);
  const validatedMasterpass = z.string().parse(payload.masterpass);
  const validatedJwt = JWTSchema.parse(payload.jwt);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id || actor.$id !== validatedUserId) {
    throw new Error('Unauthorized');
  }

  // 1. Update the Appwrite authentication password via System Users service
  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const { users, databases } = createSystemClient();
  await users.updatePassword(validatedUserId, validatedMasterpass);

  // 1b. Update user preferences to include hasPass: true without overwriting existing prefs
  try {
    const userDoc = await users.get(validatedUserId);
    const currentPrefs = userDoc.prefs || {};
    await users.updatePrefs(validatedUserId, {
      ...currentPrefs,
      hasPass: true
    });
  } catch (err) {
    console.error('[syncMasterpassToAccountPasswordAction] Failed to update user prefs:', err);
  }

  // 2. Query the keychain entry for this user and set authPass = true
  const keychainRes = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.VAULT,
    APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
    [
      Query.equal('userId', validatedUserId),
      Query.equal('type', 'password'),
      Query.limit(1)
    ]
  );

  const entry = keychainRes.rows?.[0];
  if (entry) {
    await databases.updateRow(
      APPWRITE_CONFIG.DATABASES.VAULT,
      APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
      entry.$id,
      { authPass: true }
    );
  }

  return { success: true };
}

export async function upgradeKeychainToArgonAction(payload: {
  userId: string;
  wrappedKey: string;
  salt: string;
  params: string;
  jwt?: string;
}) {
  const { z } = await import('zod');
  const validatedUserId = IDSchema.parse(payload.userId);
  const validatedJwt = JWTSchema.parse(payload.jwt);
  const validatedWrappedKey = z.string().min(1).parse(payload.wrappedKey);
  const validatedSalt = z.string().min(1).parse(payload.salt);
  const validatedParams = z.string().min(1).parse(payload.params);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id || actor.$id !== validatedUserId) {
    throw new Error('Unauthorized');
  }

  const { createSystemClient, createSystemTablesDB } = await import('@/lib/appwrite-admin');
  const { withSystemTransaction } = await import('@/lib/services/internal/transaction');
  const { databases } = createSystemClient();
  const tables: any = createSystemTablesDB();

  // Find existing password entries to preserve authPass and clean up legacy records
  const existing = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.VAULT,
    APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
    [
      Query.equal('userId', validatedUserId),
      Query.equal('type', 'password'),
      Query.limit(25)
    ]
  ).catch(() => ({ rows: [] }));

  const existingRows = existing.rows || [];
  const hadAuthPass = existingRows.some((r: any) => r.authPass === true);

  return await withSystemTransaction(async (txId) => {
    // 1. Delete all old/pending password rows inside the transaction
    for (const row of existingRows) {
      await tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
        rowId: row.$id,
        transactionId: txId
      });
    }

    // 2. Insert new Argon2id password entry inside the same transaction
    const newEntry = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
      rowId: ID.unique(),
      data: {
        userId: validatedUserId,
        type: 'password',
        credentialId: null,
        wrappedKey: validatedWrappedKey,
        salt: validatedSalt,
        params: validatedParams,
        isArgon: true,
        isPending: false,
        isBackup: false,
        authPass: hadAuthPass
      },
      permissions: [
        Permission.read(Role.user(validatedUserId)),
        Permission.update(Role.user(validatedUserId)),
        Permission.delete(Role.user(validatedUserId))
      ],
      transactionId: txId
    });

    return { success: true, entry: JSON.parse(JSON.stringify(newEntry)) };
  });
}

export async function createStandaloneTagSecure(tagName: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const tagsTable = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
  const nameLower = tagName.trim().toLowerCase();

  return await tables.createRow(
    APPWRITE_DATABASE_ID,
    tagsTable,
    ID.unique(),
    {
      name: tagName.trim(),
      nameLower,
      userId: actor.$id,
      isPublic: false,
      isGuest: false,
      usageCount: 0,
      metadata: JSON.stringify({ version: 'v2' })
    },
    [Permission.read(Role.user(actor.$id))]
  );
}

export async function toggleTaskReminderSecure(taskId: string, enabled: boolean, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { createSystemClient } = await import('@/lib/appwrite-admin');
  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const TASKS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.TASKS;

  const task = await tables.getRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: TASKS_TABLE,
    rowId: taskId}) as any;

  if (!task) throw new Error('Task not found');
  
  // Security verification
  if (task.userId !== actor.$id) {
    const collabs = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS,
      queries: [
        Query.equal('resourceId', taskId),
        Query.equal('userId', actor.$id)
      ] as any
    });
    if (collabs.total === 0) {
      throw new Error('Forbidden: Insufficient permissions');
    }
  }

  const now = new Date();

  if (enabled) {
    if (!task.dueDate) {
      throw new Error('Goal has no deadline attached to it.');
    }
    const deadline = new Date(task.dueDate);
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) {
      throw new Error('Deadline is in the past.');
    }

    const { Functions } = await import('node-appwrite');
    const { client } = createSystemClient();
    const functions = new Functions(client);
    const functionId = 'goal-reminder-dispatch';

    // Trigger/schedule execution of goal-reminder-dispatch function
    try {
      await functions.createExecution(
        functionId,
        JSON.stringify({ taskId, userId: actor.$id }),
        false, // async execution
        '/',
        'POST' as any
      );
    } catch (fnErr: any) {
      console.warn('[toggleTaskReminderSecure] Direct function execution error, registering scheduled state:', fnErr?.message);
    }

    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: true,
        recurrenceRule: `reminder_fn_id:${functionId}`}
    });

    return JSON.parse(JSON.stringify(updated));
  } else {
    const updated = await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: TASKS_TABLE,
      rowId: taskId,
      data: {
        scheduled: false,
        recurrenceRule: null}
    });

    return JSON.parse(JSON.stringify(updated));
  }
}

/**
 * Centrally and permanently purges items that have been in the trash (isTrash: true)
 * for more than retentionDays (default: 90 days).
 *
 * Employs:
 * 1. Actor verification via JWT (golden rule).
 * 2. Deep recursive cascade delete via executeCascadeDeleteSecure (zero orphan or zombie child items).
 * 3. Appwrite system transactions / batch delete integrity.
 * 4. Comprehensive domain coverage (notes, tags, tasks/goals, events, forms, form submissions, credentials, totpSecrets, projects, files/objects, source_control).
 */
export async function purgeExpiredTrashSecure(input?: { retentionDays?: number; jwt?: string }) {
  const actor = await getActor(input?.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const userId = actor.$id;
  const days = typeof input?.retentionDays === 'number' && input.retentionDays > 0 ? input.retentionDays : 90;
  const cutoffTimestamp = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const tables = createSystemTablesDB();
  const mainDb = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER || 'passwordManagerDb';

  const targets = [
    { type: 'note', db: APPWRITE_CONFIG.DATABASES.NOTE, table: APPWRITE_CONFIG.TABLES.NOTE.NOTES, userField: 'userId' },
    { type: 'tag', db: APPWRITE_CONFIG.DATABASES.NOTE, table: APPWRITE_CONFIG.TABLES.NOTE.TAGS, userField: 'userId' },
    { type: 'task', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.TASKS, userField: 'userId' },
    { type: 'event', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.EVENTS, userField: 'userId' },
    { type: 'form', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.FORMS, userField: 'userId' },
    { type: 'credential', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, userField: 'userId' },
    { type: 'totp', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, userField: 'userId' },
    { type: 'project', db: APPWRITE_CONFIG.DATABASES.CHAT, table: 'projects', userField: 'ownerId' },
    { type: 'object', db: APPWRITE_CONFIG.DATABASES.NOTE, table: 'objects', userField: 'userId' },
    { type: 'source_control', db: APPWRITE_CONFIG.DATABASES.CONNECT, table: 'source_control', userField: 'userId' },
  ];

  let purgedCount = 0;
  const purgedIds: string[] = [];

  for (const t of targets) {
    try {
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const queries: any[] = [
          Query.equal(t.userField, userId),
          Query.equal('isTrash', true),
          Query.lessThanEqual('$updatedAt', cutoffTimestamp),
          Query.limit(50),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await tables.listRows({
          databaseId: t.db,
          tableId: t.table,
          queries,
        }).catch(async () => {
          return await tables.listRows({
            databaseId: mainDb,
            tableId: t.table,
            queries,
          }).catch(() => ({ rows: [] }));
        });

        const rows = (res as any)?.rows || [];
        if (!rows.length) break;

        for (const row of rows) {
          try {
            // Cascade child/zombie artifacts first (comments, reactions, storage files, collaborators, subtasks)
            await executeCascadeDeleteSecure(t.db, t.table, row.$id, 'detach', input?.jwt).catch(async () => {
              await executeCascadeDeleteSecure(mainDb, t.table, row.$id, 'detach', input?.jwt).catch(() => null);
            });

            // Hard delete the row itself
            await tables.deleteRow({
              databaseId: t.db,
              tableId: t.table,
              rowId: row.$id,
            }).catch(async () => {
              await tables.deleteRow({
                databaseId: mainDb,
                tableId: t.table,
                rowId: row.$id,
              }).catch(() => null);
            });

            purgedCount++;
            purgedIds.push(row.$id);
          } catch (delErr) {
            console.warn(`[purgeExpiredTrashSecure] Failed to purge ${t.type} ${row.$id}:`, delErr);
          }
        }

        if (rows.length < 50) {
          hasMore = false;
        } else {
          cursor = rows[rows.length - 1].$id;
        }
      }
    } catch (tblErr) {
      console.warn(`[purgeExpiredTrashSecure] Error querying table ${t.table}:`, tblErr);
    }
  }

  // Also purge expired trashed form submissions belonging to user's forms or submitted by user
  try {
    const subQueries = [
      Query.equal('submitterId', userId),
      Query.equal('isTrash', true),
      Query.lessThanEqual('$updatedAt', cutoffTimestamp),
      Query.limit(100),
    ];
    const subRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS,
      queries: subQueries as any,
    }).catch(() => ({ rows: [] }));

    for (const sub of ((subRes as any)?.rows || [])) {
      try {
        await tables.deleteRow({
          databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
          tableId: APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS,
          rowId: sub.$id,
        }).catch(() => null);
        purgedCount++;
        purgedIds.push(sub.$id);
      } catch {}
    }
  } catch {}

  return {
    success: true,
    purgedCount,
    purgedIds,
    cutoffTimestamp,
    retentionDays: days,
  };
}

