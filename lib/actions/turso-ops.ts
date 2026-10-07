'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

function getAppwriteMigrationTablesDB(jwt?: string) {
  const apiKey = process.env.APPWRITE_API;
  try {
    const { Client, TablesDB } = require('node-appwrite');
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || APPWRITE_CONFIG.SERVER_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID || APPWRITE_CONFIG.PROJECT_ID);

    if (apiKey) {
      client.setKey(apiKey);
      return new TablesDB(client);
    } else if (jwt && jwt.length > 32) {
      client.setJWT(jwt);
      return new TablesDB(client);
    }
    return null;
  } catch (err) {
    console.warn('[turso-ops] Could not initialize Appwrite migration client:', err);
    return null;
  }
}

/**
 * Ensures a user exists in Turso/Better Auth table with deterministic user ID matching Appwrite $id.
 */
export async function ensureBetterAuthUserTurso(data: {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
}) {
  try {
    const existing = await db
      .select({ id: schema.user.id, tier1Synced: schema.user.tier1Synced, tier2Synced: schema.user.tier2Synced })
      .from(schema.user)
      .where(eq(schema.user.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.user)
        .set({
          name: data.name,
          email: data.email,
          emailVerified: Boolean(data.emailVerified),
          image: data.image || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, data.id));
      return { success: true, user: existing[0] };
    } else {
      await db.insert(schema.user).values({
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: Boolean(data.emailVerified),
        image: data.image || null,
        tier1Synced: false,
        tier2Synced: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { success: true, user: { id: data.id, tier1Synced: false, tier2Synced: false } };
    }
  } catch (err: any) {
    console.error('[turso-ops] ensureBetterAuthUserTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function getUserSyncStatusTurso(userId: string) {
  try {
    const rows = await db
      .select({
        id: schema.user.id,
        tier1Synced: schema.user.tier1Synced,
        tier2Synced: schema.user.tier2Synced,
        appwriteSyncedAt: schema.user.appwriteSyncedAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);
    if (!rows.length) return null;
    return rows[0];
  } catch (err: any) {
    console.warn('[turso-ops] getUserSyncStatusTurso error:', err);
    return null;
  }
}

// ========================================================
// TIER 1 MUTATIONS & QUERIES (CRITICAL: KEYCHAIN, VAULT, WORKSPACES)
// ========================================================

/**
 * Upserts a zero-knowledge keychain entry into Turso.
 */
export async function upsertKeychainTurso(data: typeof schema.keychain.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.keychain.id })
      .from(schema.keychain)
      .where(eq(schema.keychain.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.keychain)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.keychain.id, data.id));
    } else {
      await db.insert(schema.keychain).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertKeychainTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listKeychainTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.keychain)
      .where(eq(schema.keychain.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listKeychainTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteKeychainTurso(id: string) {
  try {
    await db.delete(schema.keychain).where(eq(schema.keychain.id, id));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteKeychainTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a zero-knowledge vault item (credential, secret, card) into Turso.
 */
export async function upsertVaultItemTurso(data: typeof schema.vaultItems.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.vaultItems.id })
      .from(schema.vaultItems)
      .where(eq(schema.vaultItems.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.vaultItems)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.vaultItems.id, data.id));
    } else {
      await db.insert(schema.vaultItems).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listVaultItemsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.vaultItems)
      .where(and(eq(schema.vaultItems.userId, userId), eq(schema.vaultItems.isTrashed, false)));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listVaultItemsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteVaultItemTurso(id: string) {
  try {
    await db
      .update(schema.vaultItems)
      .set({ isTrashed: true, updatedAt: new Date().toISOString() })
      .where(eq(schema.vaultItems.id, id));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a TOTP secret into Turso.
 */
export async function upsertTotpSecretTurso(data: typeof schema.totpSecrets.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.totpSecrets.id })
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.totpSecrets)
        .set(data)
        .where(eq(schema.totpSecrets.id, data.id));
    } else {
      await db.insert(schema.totpSecrets).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertTotpSecretTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listTotpSecretsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listTotpSecretsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteTotpSecretTurso(id: string) {
  try {
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.id, id));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteTotpSecretTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a project / workspace in Turso.
 */
export async function upsertProjectTurso(data: typeof schema.projects.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.projects)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.projects.id, data.id));
    } else {
      await db.insert(schema.projects).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertProjectTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listWorkspacesTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.creatorId, userId));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listWorkspacesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function upsertWorkspaceObjectTurso(data: typeof schema.projectObjects.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.projectObjects.id })
      .from(schema.projectObjects)
      .where(eq(schema.projectObjects.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.projectObjects)
        .set(data)
        .where(eq(schema.projectObjects.id, data.id));
    } else {
      await db.insert(schema.projectObjects).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertWorkspaceObjectTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertUserSettingsTurso(data: typeof schema.userSettings.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.userSettings.id })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, data.userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.userSettings)
        .set({
          preferences: data.preferences,
          securityFlags: data.securityFlags,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.userSettings.userId, data.userId));
    } else {
      await db.insert(schema.userSettings).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertUserSettingsTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ========================================================
// TIER 2 MUTATIONS & QUERIES (IDEAS, GOALS)
// ========================================================

/**
 * Upserts a note/idea record in Turso.
 */
export async function upsertNoteTurso(data: typeof schema.notes.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.notes.id })
      .from(schema.notes)
      .where(eq(schema.notes.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      const updateData: any = {
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id') {
          updateData[key] = val;
        }
      }
      await db
        .update(schema.notes)
        .set(updateData)
        .where(eq(schema.notes.id, data.id));
    } else {
      await db.insert(schema.notes).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertNoteTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteNoteTurso(noteId: string) {
  try {
    await db
      .update(schema.notes)
      .set({ isTrashed: true, updatedAt: new Date().toISOString() })
      .where(eq(schema.notes.id, noteId));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteNoteTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listNotesTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.notes)
      .where(and(eq(schema.notes.userId, userId), eq(schema.notes.isTrashed, false)));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listNotesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Upserts a goal/task record in Turso.
 */
export async function upsertGoalTurso(data: typeof schema.goals.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      const updateData: any = {
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id') {
          updateData[key] = val;
        }
      }
      await db
        .update(schema.goals)
        .set(updateData)
        .where(eq(schema.goals.id, data.id));
    } else {
      await db.insert(schema.goals).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listGoalsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listGoalsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteGoalTurso(goalId: string) {
  try {
    await db.delete(schema.goals).where(eq(schema.goals.id, goalId));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ========================================================
// AGGRESSIVE TIER 1 & TIER 2 MIGRATION PIPELINE
// ========================================================

/**
 * Aggressively migrates Tier 1 critical data (keychain, vault secrets, TOTPs, workspaces, project objects)
 * from Appwrite into Turso for existing accounts. Idempotent and marks tier1_synced = 1.
 */
export async function syncTier1FromAppwriteTurso(userId: string, force = false, jwt?: string) {
  if (!userId) return { success: false, error: 'No user ID' };

  try {
    const status = await getUserSyncStatusTurso(userId);
    if (!force && status?.tier1Synced) {
      return { success: true, alreadySynced: true };
    }

    const tablesDB = getAppwriteMigrationTablesDB(jwt);
    if (!tablesDB) {
      return { success: true, skipped: true, reason: 'Appwrite not configured on server' };
    }

    const { Query } = require('node-appwrite');
    const DB = 'passwordManagerDb';
    const counts = { keychain: 0, vault: 0, totp: 0, workspaces: 0, workspaceObjects: 0 };

    // 1. Keychain
    try {
      const res = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'keychain',
        queries: [Query.equal('userId', userId), Query.limit(100)],
      });
      for (const row of res.rows as any[]) {
        const metaObj = {
          credentialId: row.credentialId || null,
          params: row.params || null,
          isArgon: row.isArgon ?? null,
          ...(row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}),
        };
        await upsertKeychainTurso({
          id: row.$id,
          userId,
          account: row.credentialId || row.account || (row.type === 'passkey' ? 'passkey' : 'masterpass'),
          type: row.type || 'password',
          encryptedPayload: row.encryptedPayload || row.wrappedKey || '',
          nonce: row.nonce || row.salt || null,
          metadata: JSON.stringify(metaObj),
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
        counts.keychain++;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Keychain sync warning:', e.message);
    }

    // 2. Vault Items (credentials)
    try {
      const res = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'credentials',
        queries: [Query.equal('userId', userId), Query.limit(200)],
      });
      for (const row of res.rows as any[]) {
        await upsertVaultItemTurso({
          id: row.$id,
          userId,
          title: row.name || row.title || 'Encrypted Secret',
          type: row.itemType || row.type || 'login',
          encryptedData: row.encryptedData || row.password || row.username || '',
          iv: row.iv || null,
          metadata: JSON.stringify(row),
          isTrashed: Boolean(row.isTrash || row.isTrashed),
          isWorkspace: Boolean(row.isWorkspace),
          workspaceId: row.projectId || null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
        counts.vault++;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Vault sync warning:', e.message);
    }

    // 3. TOTP Secrets
    try {
      const res = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'totpSecrets',
        queries: [Query.equal('userId', userId), Query.limit(100)],
      });
      for (const row of res.rows as any[]) {
        await upsertTotpSecretTurso({
          id: row.$id,
          userId,
          account: row.account || row.issuer || 'totp',
          encryptedSecret: row.encryptedSecret || row.secret || '',
          metadata: row.metadata || null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
        });
        counts.totp++;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] TOTP sync warning:', e.message);
    }

    // 4. Workspaces / Projects
    const projectIds: string[] = [];
    try {
      const res = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'projects',
        queries: [Query.equal('ownerId', userId), Query.limit(100)],
      });
      for (const row of res.rows as any[]) {
        projectIds.push(row.$id);
        await upsertProjectTurso({
          id: row.$id,
          creatorId: userId,
          name: row.title || row.name || 'Workspace',
          description: row.summary || row.description || '',
          slug: row.slug || null,
          inviteCode: row.inviteCode || null,
          isPublic: Boolean(row.isPublic),
          isAgentic: Boolean(row.isAgentic),
          isLocked: Boolean(row.isLocked),
          privacyMode: Boolean(row.privacyMode),
          metadata: row.metadata || null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
        counts.workspaces++;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Workspaces sync warning:', e.message);
    }

    // 5. Workspace Objects for those projects
    if (projectIds.length > 0) {
      try {
        for (const pid of projectIds) {
          const res = await tablesDB.listRows({
            databaseId: DB,
            tableId: 'project_objects',
            queries: [Query.equal('projectId', pid), Query.limit(200)],
          });
          for (const row of res.rows as any[]) {
            await upsertWorkspaceObjectTurso({
              id: row.$id,
              workspaceId: pid,
              entityKind: row.entityKind || 'note',
              entityId: row.entityId || '',
              userId,
              createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
            });
            counts.workspaceObjects++;
          }
        }
      } catch (e: any) {
        console.warn('[syncTier1FromAppwriteTurso] Workspace objects sync warning:', e.message);
      }
    }

    // 6. Notes & Ideas (Promoted to Tier 1 Aggressive Sync)
    let notesCount = 0;
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 1000) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: '67ff05f3002502ef239e',
          queries: [
            Query.or([
              Query.equal('userId', userId),
              Query.equal('creatorId', userId),
            ]),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          await upsertNoteTurso({
            id: row.$id,
            userId,
            title: row.title || '',
            content: row.content || '',
            summary: row.summary || null,
            isLocked: Boolean(row.isLocked),
            isPublished: Boolean(row.isPublished),
            isPinned: Boolean(row.isPinned),
            isTrashed: Boolean(row.isTrash || row.isTrashed),
            isWorkspace: Boolean(row.isWorkspace),
            workspaceId: row.projectId || null,
            projectId: row.projectId || null,
            category: row.category || null,
            tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
            createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
          });
          notesCount++;
        }
        offset += res.rows.length;
        if (offset >= res.total) hasMore = false;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Notes sync warning:', e.message);
    }

    // 7. Goals & Tasks (Promoted to Tier 1 Aggressive Sync)
    let goalsCount = 0;
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 1000) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'tasks',
          queries: [
            Query.or([
              Query.equal('userId', userId),
              Query.equal('creatorId', userId),
            ]),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          await upsertGoalTurso({
            id: row.$id,
            userId,
            title: row.title || row.name || 'Untitled Goal',
            description: row.description || row.content || '',
            status: row.status || 'todo',
            priority: row.priority || 'medium',
            dueDate: row.dueDate || null,
            completedAt: row.completedAt || null,
            isWorkspace: Boolean(row.isWorkspace),
            workspaceId: row.projectId || null,
            projectId: row.projectId || null,
            tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
            createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
          });
          goalsCount++;
        }
        offset += res.rows.length;
        if (offset >= res.total) hasMore = false;
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Goals sync warning:', e.message);
    }

    // Mark Tier 1 and Tier 2 Synced on Turso user row
    await db
      .update(schema.user)
      .set({
        tier1Synced: true,
        tier2Synced: true,
        appwriteSyncedAt: new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    const totalCounts = { ...counts, notes: notesCount, goals: goalsCount };
    console.log(`[syncTier1FromAppwriteTurso] All Tier 1 data sync completed for user ${userId}:`, totalCounts);
    return { success: true, counts: totalCounts };
  } catch (err: any) {
    console.error('[syncTier1FromAppwriteTurso] Critical failure during Tier 1 sync:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Opportunistically migrates Tier 2 secondary data (notes, goals, tasks) from Appwrite into Turso.
 * Marks tier2_synced = 1 upon completion.
 */
export async function syncTier2FromAppwriteTurso(userId: string, force = false) {
  if (!userId) return { success: false, error: 'No user ID' };

  try {
    const status = await getUserSyncStatusTurso(userId);
    if (!force && status?.tier2Synced) {
      return { success: true, alreadySynced: true };
    }

    const tablesDB = getAppwriteMigrationTablesDB();
    if (!tablesDB) {
      return { success: true, skipped: true, reason: 'Appwrite not configured on server' };
    }

    const { Query } = require('node-appwrite');
    const DB = 'passwordManagerDb';
    const counts = { notes: 0, goals: 0 };

    // 1. Notes (Ideas)
    let notesFailed = false;
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 500) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: '67ff05f3002502ef239e',
          queries: [
            Query.or([
              Query.equal('userId', userId),
              Query.equal('creatorId', userId),
            ]),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          await upsertNoteTurso({
            id: row.$id,
            userId,
            title: row.title || '',
            content: row.content || '',
            summary: row.summary || null,
            isLocked: Boolean(row.isLocked),
            isPublished: Boolean(row.isPublished),
            isPinned: Boolean(row.isPinned),
            isTrashed: Boolean(row.isTrash || row.isTrashed),
            isWorkspace: Boolean(row.isWorkspace),
            workspaceId: row.projectId || null,
            projectId: row.projectId || null,
            category: row.category || null,
            tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
            createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
          });
          counts.notes++;
        }
        offset += res.rows.length;
        if (offset >= res.total) hasMore = false;
      }
    } catch (e: any) {
      notesFailed = true;
      console.warn('[syncTier2FromAppwriteTurso] Notes sync warning:', e.message);
    }

    // 2. Goals (Tasks)
    let goalsFailed = false;
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 500) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'tasks',
          queries: [
            Query.or([
              Query.equal('userId', userId),
              Query.equal('creatorId', userId),
            ]),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          await upsertGoalTurso({
            id: row.$id,
            userId,
            title: row.title || row.name || 'Untitled Goal',
            description: row.description || row.content || '',
            status: row.status || 'todo',
            priority: row.priority || 'medium',
            dueDate: row.dueDate || null,
            completedAt: row.completedAt || null,
            isWorkspace: Boolean(row.isWorkspace),
            workspaceId: row.projectId || null,
            projectId: row.projectId || null,
            tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
            createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
          });
          counts.goals++;
        }
        offset += res.rows.length;
        if (offset >= res.total) hasMore = false;
      }
    } catch (e: any) {
      goalsFailed = true;
      console.warn('[syncTier2FromAppwriteTurso] Goals sync warning:', e.message);
    }

    // Mark Tier 2 Synced on Turso user row if at least one category succeeded
    if (!notesFailed || !goalsFailed) {
      await db
        .update(schema.user)
        .set({
          tier2Synced: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, userId));
    }

    console.log(`[syncTier2FromAppwriteTurso] Tier 2 sync completed for user ${userId}:`, counts);
    return { success: true, counts };
  } catch (err: any) {
    console.error('[syncTier2FromAppwriteTurso] Secondary failure during Tier 2 sync:', err);
    return { success: false, error: err.message };
  }
}
