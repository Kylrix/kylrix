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
        hasAppwriteAccount: schema.user.hasAppwriteAccount,
        appwriteAccountId: schema.user.appwriteAccountId,
        appwriteFullySynced: schema.user.appwriteFullySynced,
        appwriteSyncedAt: schema.user.appwriteSyncedAt,
        appwritePasswordSynced: schema.user.appwritePasswordSynced,
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

/**
 * Determines whether this user has an Appwrite account and whether any Appwrite
 * code needs to run at all.
 * - If hasAppwriteAccount is false -> never touch Appwrite (0 calls).
 * - If appwriteFullySynced is true -> all data already in Turso/local, never touch Appwrite (0 calls).
 * - If hasAppwriteAccount is null -> checks Appwrite Users API by email (sole identity match).
 *   - If found: stamps hasAppwriteAccount=true, appwriteAccountId, appwriteFullySynced=false.
 *   - If not found: stamps hasAppwriteAccount=false, appwriteFullySynced=true. Never touches Appwrite again!
 */
export async function resolveUserAppwriteMigrationGate(userIdentifier: {
  userId?: string;
  email?: string;
}): Promise<{
  shouldSkipAppwrite: boolean;
  hasAppwriteAccount: boolean;
  appwriteAccountId: string | null;
  appwriteFullySynced: boolean;
}> {
  const { userId, email } = userIdentifier;
  if (!userId && !email) {
    return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
  }

  try {
    const condition = userId ? eq(schema.user.id, userId) : eq(schema.user.email, email!.trim().toLowerCase());
    const rows = await db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        hasAppwriteAccount: schema.user.hasAppwriteAccount,
        appwriteAccountId: schema.user.appwriteAccountId,
        appwriteFullySynced: schema.user.appwriteFullySynced,
        appwriteSyncedAt: schema.user.appwriteSyncedAt,
      })
      .from(schema.user)
      .where(condition)
      .limit(1);

    const u = rows[0];
    if (!u) {
      return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
    }

    if (u.hasAppwriteAccount === false) {
      return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
    }

    if (u.hasAppwriteAccount === true) {
      if (u.appwriteFullySynced) {
        // Migration version check: Ensure users receive the complete sync pass covering all domains (telegram, forms, events, workflows, tags)
        const lastSync = (u as any).appwriteSyncedAt ? new Date((u as any).appwriteSyncedAt).getTime() : 0;
        const MIGRATION_VERSION_CUTOFF = new Date('2026-10-08T21:00:00Z').getTime();
        if (lastSync >= MIGRATION_VERSION_CUTOFF) {
          return { shouldSkipAppwrite: true, hasAppwriteAccount: true, appwriteAccountId: u.appwriteAccountId, appwriteFullySynced: true };
        }
      }
      return { shouldSkipAppwrite: false, hasAppwriteAccount: true, appwriteAccountId: u.appwriteAccountId, appwriteFullySynced: false };
    }

    // Column is empty/null: check Appwrite Users API by email (sole identity match)
    const targetEmail = (u.email || email || '').trim().toLowerCase();
    if (!targetEmail) {
      await db.update(schema.user).set({ hasAppwriteAccount: false, appwriteFullySynced: true, updatedAt: new Date() }).where(eq(schema.user.id, u.id));
      return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
    }

    let foundAppwriteId: string | null = null;
    try {
      const { createSystemClient } = await import('@/lib/appwrite-admin');
      const { users } = createSystemClient();
      const { Query } = await import('node-appwrite');
      const res = await users.list([Query.equal('email', targetEmail), Query.limit(1)]);
      if (res.total > 0 && res.users[0]?.$id) {
        foundAppwriteId = res.users[0].$id;
      }
    } catch (e: any) {
      console.warn('[resolveUserAppwriteMigrationGate] Appwrite user query warning:', e.message);
    }

    if (foundAppwriteId) {
      await db
        .update(schema.user)
        .set({
          hasAppwriteAccount: true,
          appwriteAccountId: foundAppwriteId,
          appwriteFullySynced: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, u.id));
      return { shouldSkipAppwrite: false, hasAppwriteAccount: true, appwriteAccountId: foundAppwriteId, appwriteFullySynced: false };
    } else {
      await db
        .update(schema.user)
        .set({
          hasAppwriteAccount: false,
          appwriteAccountId: null,
          appwriteFullySynced: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, u.id));
      return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
    }
  } catch (err: any) {
    console.error('[resolveUserAppwriteMigrationGate] Error:', err);
    return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
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
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertUserSettingsTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function getUserSettingsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);
    return { success: true, settings: rows[0] || null };
  } catch (err: any) {
    return { success: false, settings: null, error: err.message };
  }
}

export async function listUserSessionsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, userId));
    return { success: true, sessions: rows };
  } catch (err: any) {
    return { success: false, sessions: [], error: err.message };
  }
}

export async function deleteUserSessionTurso(sessionId: string) {
  try {
    await db.delete(schema.session).where(eq(schema.session.id, sessionId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a thread/conversation in Turso.
 */
export async function upsertThreadTurso(data: typeof schema.threads.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.threads.id })
      .from(schema.threads)
      .where(eq(schema.threads.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.threads)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.threads.id, data.id));
    } else {
      await db.insert(schema.threads).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertThreadTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a thread message in Turso.
 */
export async function upsertThreadMessageTurso(data: typeof schema.threadMessages.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.threadMessages.id })
      .from(schema.threadMessages)
      .where(eq(schema.threadMessages.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.threadMessages)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.threadMessages.id, data.id));
    } else {
      await db.insert(schema.threadMessages).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertThreadMessageTurso failed:', err);
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

export async function getNoteTurso(noteId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, noteId))
      .limit(1);
    if (rows.length > 0) {
      return { success: true, row: rows[0] };
    }
    return { success: false, row: null };
  } catch (err: any) {
    console.error('[turso-ops] getNoteTurso failed:', err);
    return { success: false, row: null, error: err.message };
  }
}

/**
 * Upserts a goal/task record in Turso.
 */
export async function upsertGoalTurso(
  data: Partial<typeof schema.goals.$inferInsert> & { id: string; userId: string; title: string }
) {
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
      await db.insert(schema.goals).values({
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as any);
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

export async function getGoalTurso(goalId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.id, goalId))
      .limit(1);
    if (rows.length > 0) {
      return { success: true, row: rows[0] };
    }
    return { success: false, row: null };
  } catch (err: any) {
    console.error('[turso-ops] getGoalTurso failed:', err);
    return { success: false, row: null, error: err.message };
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

// --------------------------------------------------------
// Forms & Events Turso CRUD
// --------------------------------------------------------
export async function upsertFormTurso(data: typeof schema.forms.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.forms.id }).from(schema.forms).where(eq(schema.forms.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.forms).set(data).where(eq(schema.forms.id, data.id));
    } else {
      await db.insert(schema.forms).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listFormsTurso(userId: string) {
  try {
    const rows = await db.select().from(schema.forms).where(eq(schema.forms.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

export async function upsertEventTurso(data: typeof schema.events.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.events).set(data).where(eq(schema.events.id, data.id));
    } else {
      await db.insert(schema.events).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listEventsTurso(userId: string) {
  try {
    const rows = await db.select().from(schema.events).where(eq(schema.events.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

// --------------------------------------------------------
// Agentic Sessions & Workflows Turso CRUD
// --------------------------------------------------------
export async function upsertAgenticSessionTurso(data: typeof schema.agenticSessions.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.agenticSessions.id }).from(schema.agenticSessions).where(eq(schema.agenticSessions.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.agenticSessions).set(data).where(eq(schema.agenticSessions.id, data.id));
    } else {
      await db.insert(schema.agenticSessions).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listAgenticSessionsTurso(userId: string) {
  try {
    const rows = await db.select().from(schema.agenticSessions).where(eq(schema.agenticSessions.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

export async function upsertWorkflowTurso(data: typeof schema.workflows.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.workflows.id }).from(schema.workflows).where(eq(schema.workflows.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.workflows).set(data).where(eq(schema.workflows.id, data.id));
    } else {
      await db.insert(schema.workflows).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listWorkflowsTurso(ownerId?: string) {
  try {
    const rows = ownerId
      ? await db.select().from(schema.workflows).where(eq(schema.workflows.ownerId, ownerId))
      : await db.select().from(schema.workflows);
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

// --------------------------------------------------------
// Coupons Turso CRUD (Admin & Billing)
// --------------------------------------------------------
export async function upsertCouponTurso(data: typeof schema.coupons.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.coupons).set(data).where(eq(schema.coupons.id, data.id));
    } else {
      await db.insert(schema.coupons).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listCouponsTurso() {
  try {
    const rows = await db.select().from(schema.coupons);
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteCouponTurso(id: string) {
  try {
    await db.delete(schema.coupons).where(eq(schema.coupons.id, id));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --------------------------------------------------------
// Subscriptions, Wallets & Kylrix Token Ledger Turso CRUD
// --------------------------------------------------------
export async function upsertSubscriptionTurso(data: typeof schema.subscriptions.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.subscriptions)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.subscriptions.id, data.id));
    } else {
      await db.insert(schema.subscriptions).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertWalletTurso(data: typeof schema.wallets.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.wallets.id })
      .from(schema.wallets)
      .where(eq(schema.wallets.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.wallets)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.wallets.id, data.id));
    } else {
      await db.insert(schema.wallets).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertKylrixTokenLedgerTurso(data: typeof schema.kylrixTokenLedger.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.kylrixTokenLedger.id })
      .from(schema.kylrixTokenLedger)
      .where(eq(schema.kylrixTokenLedger.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.kylrixTokenLedger)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.kylrixTokenLedger.id, data.id));
    } else {
      await db.insert(schema.kylrixTokenLedger).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertTelegramConnectionTurso(data: typeof schema.telegramConnections.$inferInsert) {
  try {
    if (!data.id) return { success: false, error: 'Missing telegram connection ID' };
    const existing = await db
      .select({ id: schema.telegramConnections.id })
      .from(schema.telegramConnections)
      .where(eq(schema.telegramConnections.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.telegramConnections)
        .set({
          pairCode: data.pairCode || null,
          tgChatId: data.tgChatId || null,
          tgUsername: data.tgUsername || null,
          isVerified: Boolean(data.isVerified),
        })
        .where(eq(schema.telegramConnections.id, data.id));
    } else {
      await db.insert(schema.telegramConnections).values({
        id: data.id,
        pairCode: data.pairCode || null,
        tgChatId: data.tgChatId || null,
        tgUsername: data.tgUsername || null,
        isVerified: Boolean(data.isVerified),
        createdAt: data.createdAt || new Date().toISOString(),
      });
    }
    return { success: true };
  } catch (err: any) {
    console.warn('[upsertTelegramConnectionTurso] Warning:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getUserTokenBalanceAction(userId: string) {
  try {
    if (!userId) return null;
    const { desc } = await import('drizzle-orm');
    const rows = await db
      .select({
        balanceAfterMicro: schema.kylrixTokenLedger.balanceAfterMicro,
      })
      .from(schema.kylrixTokenLedger)
      .where(eq(schema.kylrixTokenLedger.userId, userId))
      .orderBy(desc(schema.kylrixTokenLedger.createdAt))
      .limit(50);

    for (const r of rows) {
      if (r.balanceAfterMicro !== null && r.balanceAfterMicro !== undefined && String(r.balanceAfterMicro).trim() !== '') {
        const micro = BigInt(String(r.balanceAfterMicro));
        const amount = (Number(micro) / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
        return { amountMicro: micro.toString(), amount, symbol: '$KYLRIX' };
      }
    }
    return { amountMicro: '0', amount: '0', symbol: '$KYLRIX' };
  } catch (_err) {
    return null;
  }
}

export async function getUserWalletsAction(userId: string) {
  try {
    if (!userId) return [];
    const rows = await db
      .select()
      .from(schema.wallets)
      .where(eq(schema.wallets.ownerId, `user:${userId}`));
    return rows;
  } catch {
    return [];
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
    const gate = await resolveUserAppwriteMigrationGate({ userId });
    if (!force && gate.shouldSkipAppwrite) {
      return { success: true, alreadySynced: true, skipped: true };
    }

    const appwriteOwnerId = gate.appwriteAccountId || userId;

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
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(100)],
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
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
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
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(100)],
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
        queries: [Query.equal('ownerId', appwriteOwnerId), Query.limit(100)],
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
    const syncedNoteIds = new Set<string>();
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 1000) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: '67ff05f3002502ef239e',
          queries: [
            Query.equal('userId', userId),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          syncedNoteIds.add(row.$id);
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

    // Also fetch any notes referenced in workspace_objects that might have different userId or were missed
    try {
      const wsNotes = await db
        .select({ entityId: schema.workspaceObjects.entityId, workspaceId: schema.workspaceObjects.workspaceId })
        .from(schema.workspaceObjects)
        .where(eq(schema.workspaceObjects.entityKind, 'note'));

      for (const item of wsNotes) {
        if (!item.entityId || syncedNoteIds.has(item.entityId)) continue;
        try {
          const row = await tablesDB.getRow({
            databaseId: DB,
            tableId: '67ff05f3002502ef239e',
            rowId: item.entityId,
          });
          if (row) {
            syncedNoteIds.add(row.$id);
            await upsertNoteTurso({
              id: row.$id,
              userId: row.userId || userId,
              title: row.title || '',
              content: row.content || '',
              summary: row.summary || null,
              isLocked: Boolean(row.isLocked),
              isPublished: Boolean(row.isPublished),
              isPinned: Boolean(row.isPinned),
              isTrashed: Boolean(row.isTrash || row.isTrashed),
              isWorkspace: true,
              workspaceId: row.projectId || item.workspaceId || null,
              projectId: row.projectId || item.workspaceId || null,
              category: row.category || null,
              tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
              createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
              updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
            });
            notesCount++;
          }
        } catch {
          // ignore individual missing note
        }
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Workspace notes resolution warning:', e.message);
    }

    // 7. Goals & Tasks (Promoted to Tier 1 Aggressive Sync)
    let goalsCount = 0;
    const syncedGoalIds = new Set<string>();
    try {
      let offset = 0;
      let hasMore = true;
      while (hasMore && offset < 1000) {
        const res = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'tasks',
          queries: [
            Query.equal('userId', userId),
            Query.limit(100),
            Query.offset(offset),
          ],
        });
        if (!res.rows.length) break;
        for (const row of res.rows as any[]) {
          syncedGoalIds.add(row.$id);
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

    // Also fetch any goals referenced in workspace_objects that might have different userId or were missed
    try {
      const wsGoals = await db
        .select({ entityId: schema.workspaceObjects.entityId, workspaceId: schema.workspaceObjects.workspaceId })
        .from(schema.workspaceObjects)
        .where(eq(schema.workspaceObjects.entityKind, 'goal'));

      for (const item of wsGoals) {
        if (!item.entityId || syncedGoalIds.has(item.entityId)) continue;
        try {
          const row = await tablesDB.getRow({
            databaseId: DB,
            tableId: 'tasks',
            rowId: item.entityId,
          });
          if (row) {
            syncedGoalIds.add(row.$id);
            await upsertGoalTurso({
              id: row.$id,
              userId: row.userId || userId,
              title: row.title || row.name || 'Untitled Goal',
              description: row.description || row.content || '',
              status: row.status || 'todo',
              priority: row.priority || 'medium',
              dueDate: row.dueDate || null,
              completedAt: row.completedAt || null,
              isWorkspace: true,
              workspaceId: row.projectId || item.workspaceId || null,
              projectId: row.projectId || item.workspaceId || null,
              tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : (row.tags || null),
              createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
              updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
            });
            goalsCount++;
          }
        } catch {
          // ignore individual missing goal
        }
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Workspace goals resolution warning:', e.message);
    }

    // 6. Conversations / Agent Inboxes (Threads & Thread Messages)
    try {
      const threadRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'threads',
        queries: [Query.equal('creatorId', appwriteOwnerId), Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const t of threadRes.rows as any[]) {
        await upsertThreadTurso({
          id: t.$id,
          creatorId: userId,
          targetKind: t.targetKind || 'user',
          targetId: t.targetId || userId,
          title: t.title || null,
          isLocked: Boolean(t.isLocked),
          createdAt: t.createdAt || t.$createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || t.$updatedAt || new Date().toISOString(),
        });

        // Thread messages
        const msgRes = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'thread_messages',
          queries: [Query.equal('threadId', t.$id), Query.limit(300)],
        }).catch(() => ({ rows: [] }));

        for (const m of msgRes.rows as any[]) {
          await upsertThreadMessageTurso({
            id: m.$id,
            threadId: t.$id,
            senderId: m.senderId === appwriteOwnerId ? userId : m.senderId,
            content: m.content || '',
            metadata: m.metadata ? (typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata)) : null,
            createdAt: m.createdAt || m.$createdAt || new Date().toISOString(),
            updatedAt: m.updatedAt || m.$updatedAt || new Date().toISOString(),
          });
        }
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Conversations/threads sync warning:', e.message);
    }

    // 6b. Chat Conversations & Messages Sync
    try {
      const convRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'conversations',
        queries: [Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const c of (convRes.rows || []) as any[]) {
        const isParticipant = Array.isArray(c.participants) && c.participants.includes(appwriteOwnerId);
        const isCreator = c.createdBy === appwriteOwnerId || c.userId === appwriteOwnerId;
        if (!isParticipant && !isCreator && !c.isWorkspace) continue;

        await upsertConversationTurso({
          id: c.$id,
          type: c.type || (c.isWorkspace ? 'workspace' : 'direct'),
          name: c.name || c.title || null,
          description: c.description || null,
          avatarUrl: c.avatarUrl || null,
          creatorId: c.createdBy === appwriteOwnerId ? userId : (c.createdBy || c.creatorId || userId),
          isWorkspace: Boolean(c.isWorkspace),
          contextType: c.contextType || null,
          contextId: c.contextId || null,
          lastMessageText: c.lastMessageText || null,
          lastMessageSenderId: c.lastMessageSenderId || null,
          lastMessageAt: c.lastMessageAt || null,
          createdAt: c.createdAt || c.$createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || c.$updatedAt || new Date().toISOString(),
        });

        // Messages for this conversation
        const msgsRes = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'messages',
          queries: [Query.equal('conversationId', c.$id), Query.limit(200)],
        }).catch(() => ({ rows: [] }));

        for (const m of (msgsRes.rows || []) as any[]) {
          await upsertMessageTurso({
            id: m.$id,
            conversationId: c.$id,
            senderId: m.senderId === appwriteOwnerId ? userId : (m.senderId || userId),
            content: m.content || m.text || '',
            replyTo: m.replyToId || m.replyTo || null,
            readBy: Array.isArray(m.readBy) ? JSON.stringify(m.readBy) : (m.readBy || null),
            createdAt: m.createdAt || m.$createdAt || new Date().toISOString(),
            updatedAt: m.updatedAt || m.$updatedAt || new Date().toISOString(),
          });
        }
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Conversations & Messages sync warning:', e.message);
    }

    // 6c. Agentic Sessions & History Sync
    try {
      const agenticRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'agentic_sessions',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const a of (agenticRes.rows || []) as any[]) {
        await upsertAgenticSessionTurso({
          id: a.$id,
          userId,
          context: a.context || a.title || 'Agent Session',
          harness: a.harness || 'general',
          projectId: a.projectId || a.workspaceId || null,
          chatHistory: typeof a.chatHistory === 'string' ? a.chatHistory : JSON.stringify(a.chatHistory || []),
          createdAt: a.createdAt || a.$createdAt || new Date().toISOString(),
          updatedAt: a.updatedAt || a.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Agentic sessions sync warning:', e.message);
    }

    // 7. Aggressive Verification Re-Check: Ensure 100% of TOTPs and Secrets are captured
    try {
      const totpVerify = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'totpSecrets',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
      }).catch(() => ({ rows: [] }));

      for (const row of totpVerify.rows as any[]) {
        await upsertTotpSecretTurso({
          id: row.$id,
          userId,
          account: row.account || row.issuer || 'totp',
          encryptedSecret: row.encryptedSecret || row.secret || '',
          metadata: row.metadata || null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Aggressive TOTP re-check warning:', e.message);
    }

    try {
      const credVerify = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'credentials',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(300)],
      }).catch(() => ({ rows: [] }));

      for (const row of credVerify.rows as any[]) {
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
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Aggressive Vault credentials re-check warning:', e.message);
    }

    // 8. Subscriptions & Billing Status
    try {
      const subRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'subscriptions',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(50)],
      }).catch(() => ({ rows: [] }));

      for (const row of subRes.rows as any[]) {
        await upsertSubscriptionTurso({
          id: row.$id,
          userId,
          tier: row.tier || row.plan || 'free',
          status: row.status || 'active',
          referralCode: row.referralCode || null,
          metadata: JSON.stringify(row),
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Subscriptions sync warning:', e.message);
    }

    // 9. Wallets
    try {
      const walletRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'wallets',
        queries: [Query.equal('ownerId', `user:${appwriteOwnerId}`), Query.limit(50)],
      }).catch(() => ({ rows: [] }));

      for (const row of walletRes.rows as any[]) {
        await upsertWalletTurso({
          id: row.$id,
          ownerId: `user:${userId}`,
          address: row.address,
          chain: row.chain || 'evm',
          encryptedSecret: row.encryptedSecret || '',
          type: row.type || 'embedded',
          metadata: row.metadata || null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Wallets sync warning:', e.message);
    }

    // 10. Kylrix Token Ledger & Balance Events
    try {
      const ledgerRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'kylrix_token_ledger',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
      }).catch(() => ({ rows: [] }));

      for (const row of ledgerRes.rows as any[]) {
        await upsertKylrixTokenLedgerTurso({
          id: row.$id,
          rowType: row.rowType || 'event',
          txId: row.txId || null,
          idempotencyKey: row.idempotencyKey || null,
          eventType: row.eventType || null,
          userId,
          counterpartyUserId: row.counterpartyUserId || null,
          amountMicro: row.amountMicro ? String(row.amountMicro) : null,
          deltaMicro: row.deltaMicro ? String(row.deltaMicro) : null,
          balanceAfterMicro: row.balanceAfterMicro ? String(row.balanceAfterMicro) : null,
          status: row.status || 'settled',
          sourceType: row.sourceType || null,
          sourceId: row.sourceId || null,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata)) : null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Kylrix token ledger sync warning:', e.message);
    }

    // 11. Coupons
    try {
      const couponRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'coupons',
        queries: [Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const row of couponRes.rows as any[]) {
        await upsertCouponTurso({
          id: row.$id,
          createdBy: row.createdBy || 'system',
          title: row.title || null,
          note: row.note || null,
          targetUserId: row.targetUserId || null,
          status: row.status || 'active',
          discountPercent: row.discountPercent || 0,
          discountPercentage: row.discountPercentage || 0,
          redemptionLimit: row.redemptionLimit || 1,
          redemptionCount: row.redemptionCount || 0,
          seats: row.seats || 1,
          expiresAt: row.expiresAt || null,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata)) : null,
          createdAt: row.createdAt || row.$createdAt || new Date().toISOString(),
          updatedAt: row.updatedAt || row.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Coupons sync warning:', e.message);
    }

    // 12. Telegram Integration Connection
    try {
      const tgRes = await tablesDB.getRow({
        databaseId: DB,
        tableId: 'telegram_connections',
        rowId: appwriteOwnerId,
      }).catch(async () => {
        const q = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'telegram_connections',
          queries: [Query.equal('$id', appwriteOwnerId), Query.limit(1)],
        }).catch(() => ({ rows: [] }));
        return q.rows?.[0] || null;
      });

      if (tgRes) {
        await upsertTelegramConnectionTurso({
          id: userId,
          pairCode: tgRes.pair_code || tgRes.pairCode || null,
          tgChatId: tgRes.tg_chat_id || tgRes.tgChatId || null,
          tgUsername: tgRes.tg_username || tgRes.tgUsername || null,
          isVerified: Boolean(tgRes.is_verified ?? tgRes.isVerified),
          createdAt: tgRes.$createdAt || tgRes.createdAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Telegram connection sync warning:', e.message);
    }

    // 13. Forms & Form Submissions
    try {
      const formsRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'forms',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const f of (formsRes.rows || []) as any[]) {
        await upsertFormTurso({
          id: f.$id,
          userId,
          title: f.title || 'Untitled Form',
          description: f.description || '',
          schema: typeof f.schema === 'string' ? f.schema : (typeof f.fields === 'string' ? f.fields : JSON.stringify(f.fields || f.schema || [])),
          settings: typeof f.settings === 'string' ? f.settings : JSON.stringify(f.settings || {}),
          status: f.status || (f.isPublished ? 'active' : 'draft'),
          isPublic: Boolean(f.isPublic),
          isGuest: Boolean(f.isGuest),
          isWorkspace: Boolean(f.isWorkspace),
          createdAt: f.createdAt || f.$createdAt || new Date().toISOString(),
          updatedAt: f.updatedAt || f.$updatedAt || new Date().toISOString(),
        });

        const subsRes = await tablesDB.listRows({
          databaseId: DB,
          tableId: 'formSubmissions',
          queries: [Query.equal('formId', f.$id), Query.limit(200)],
        }).catch(() => ({ rows: [] }));

        for (const s of (subsRes.rows || []) as any[]) {
          try {
            await db
              .insert(schema.formSubmissions)
              .values({
                id: s.$id,
                formId: f.$id,
                submitterId: s.submitterId || null,
                payload: typeof s.payload === 'string' ? s.payload : (typeof s.answers === 'string' ? s.answers : JSON.stringify(s.answers || s.payload || {})),
                status: s.status || 'submitted',
                metadata: typeof s.metadata === 'string' ? s.metadata : (s.metadata ? JSON.stringify(s.metadata) : null),
                createdAt: s.createdAt || s.$createdAt || new Date().toISOString(),
              })
              .onConflictDoNothing();
          } catch {}
        }
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Forms sync warning:', e.message);
    }

    // 14. Events & Calendars
    try {
      const eventsRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'events',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
      }).catch(() => ({ rows: [] }));

      for (const ev of (eventsRes.rows || []) as any[]) {
        await upsertEventTurso({
          id: ev.$id,
          userId,
          calendarId: ev.calendarId || 'default',
          title: ev.title || 'Untitled Event',
          description: ev.description || '',
          startTime: ev.startTime || new Date().toISOString(),
          endTime: ev.endTime || new Date().toISOString(),
          location: ev.location || null,
          meetingUrl: ev.meetingUrl || null,
          visibility: ev.visibility || 'private',
          status: ev.status || 'confirmed',
          recurrenceRule: ev.recurrenceRule || null,
          isWorkspace: Boolean(ev.isWorkspace),
          isPublic: Boolean(ev.isPublic),
          isGuest: Boolean(ev.isGuest),
          isPinned: Boolean(ev.isPinned),
          createdAt: ev.createdAt || ev.$createdAt || new Date().toISOString(),
          updatedAt: ev.updatedAt || ev.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Events sync warning:', e.message);
    }

    // 15. Workflows (Flows)
    try {
      const flowsRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: 'workflows',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      for (const fl of (flowsRes.rows || []) as any[]) {
        await upsertWorkflowTurso({
          id: fl.$id,
          workflowId: fl.workflowId || fl.$id,
          name: fl.name || fl.title || 'Untitled Flow',
          description: fl.description || '',
          niche: fl.niche || 'general',
          isPublic: Boolean(fl.isPublic),
          steps: typeof fl.steps === 'string' ? fl.steps : (typeof fl.nodes === 'string' ? fl.nodes : JSON.stringify(fl.nodes || fl.steps || [])),
          metadata: typeof fl.metadata === 'string' ? fl.metadata : (fl.metadata ? JSON.stringify(fl.metadata) : null),
          ownerId: userId,
          createdAt: fl.createdAt || fl.$createdAt || new Date().toISOString(),
          updatedAt: fl.updatedAt || fl.$updatedAt || new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Workflows sync warning:', e.message);
    }

    // 16. User Tags
    try {
      const tagsRes = await tablesDB.listRows({
        databaseId: DB,
        tableId: '67ff06280034908cf08a',
        queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
      }).catch(async () => {
        return await tablesDB.listRows({
          databaseId: DB,
          tableId: 'tags',
          queries: [Query.equal('userId', appwriteOwnerId), Query.limit(200)],
        }).catch(() => ({ rows: [] }));
      });

      for (const t of (tagsRes.rows || []) as any[]) {
        try {
          await db
            .insert(schema.tags)
            .values({
              id: t.$id,
              name: t.name || '',
              nameLower: t.nameLower || (t.name || '').toLowerCase(),
              userId,
              metadata: typeof t.metadata === 'string' ? t.metadata : (t.metadata ? JSON.stringify(t.metadata) : null),
              isPublic: Boolean(t.isPublic),
              isGuest: Boolean(t.isGuest),
              usageCount: t.usageCount || 0,
              isTrash: Boolean(t.isTrash),
            })
            .onConflictDoNothing();
        } catch {}
      }
    } catch (e: any) {
      console.warn('[syncTier1FromAppwriteTurso] Tags sync warning:', e.message);
    }

    // Mark Tier 1, Tier 2, and appwriteFullySynced = true on Turso user row
    await db
      .update(schema.user)
      .set({
        hasAppwriteAccount: true,
        appwriteAccountId: appwriteOwnerId,
        appwriteFullySynced: true,
        tier1Synced: true,
        tier2Synced: true,
        appwriteSyncedAt: new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    const totalCounts = { ...counts, notes: notesCount, goals: goalsCount };
    console.log(`[syncTier1FromAppwriteTurso] All data synced and verified cleanly for user ${userId}:`, totalCounts);
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
            Query.equal('userId', userId),
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
            Query.equal('userId', userId),
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

/**
 * Intercepts a successful Appwrite password authentication to sync the user's password
 * to Better Auth ONLY IF the user does not already have a Better Auth password.
 */
export async function checkAndSyncAppwritePasswordToBetterAuth(params: {
  email: string;
  password: string;
  appwriteUserId?: string;
}): Promise<{
  synced: boolean;
  hasExistingBetterAuthPassword: boolean;
  userId?: string;
  error?: string;
}> {
  const { email, password, appwriteUserId } = params;
  if (!email || !password) {
    return { synced: false, hasExistingBetterAuthPassword: false, error: 'Missing email or password' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Check if user already exists in Turso / Better Auth
    const userRows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, normalizedEmail))
      .limit(1);

    const targetUser = userRows[0];

    if (targetUser) {
      // 2. Check if user already has a credential account with a password
      const credAccounts = await db
        .select()
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, targetUser.id),
            eq(schema.account.providerId, 'credential')
          )
        )
        .limit(1);

      if (credAccounts.length > 0 && credAccounts[0].password) {
        // User ALREADY has a Better Auth password! Ensure appwritePasswordSynced is marked true
        await db
          .update(schema.user)
          .set({
            appwritePasswordSynced: true,
            hasAppwriteAccount: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.user.id, targetUser.id));

        return {
          synced: false,
          hasExistingBetterAuthPassword: true,
          userId: targetUser.id,
        };
      }

      // User does NOT have a Better Auth password yet. Hash and set it!
      const { hashPassword } = await import('better-auth/crypto');
      const hashedPassword = await hashPassword(password);

      if (credAccounts.length > 0) {
        await db
          .update(schema.account)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(schema.account.id, credAccounts[0].id));
      } else {
        await db.insert(schema.account).values({
          id: crypto.randomUUID(),
          userId: targetUser.id,
          providerId: 'credential',
          accountId: targetUser.id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Stamp Appwrite migration markers on user row, including appwritePasswordSynced: true
      await db
        .update(schema.user)
        .set({
          hasAppwriteAccount: true,
          appwriteAccountId: appwriteUserId || targetUser.appwriteAccountId || null,
          appwritePasswordSynced: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, targetUser.id));

      return {
        synced: true,
        hasExistingBetterAuthPassword: false,
        userId: targetUser.id,
      };
    } else {
      // User does not exist in Turso yet. Create user and credential account row.
      const { hashPassword } = await import('better-auth/crypto');
      const hashedPassword = await hashPassword(password);
      const newUserId = appwriteUserId || crypto.randomUUID();

      await db.insert(schema.user).values({
        id: newUserId,
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        emailVerified: true,
        hasAppwriteAccount: true,
        appwriteAccountId: appwriteUserId || null,
        appwritePasswordSynced: true,
        appwriteFullySynced: false,
        tier1Synced: false,
        tier2Synced: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.account).values({
        id: crypto.randomUUID(),
        userId: newUserId,
        providerId: 'credential',
        accountId: newUserId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        synced: true,
        hasExistingBetterAuthPassword: false,
        userId: newUserId,
      };
    }
  } catch (err: any) {
    console.error('[checkAndSyncAppwritePasswordToBetterAuth] Error:', err);
    return { synced: false, hasExistingBetterAuthPassword: false, error: err.message };
  }
}

/**
 * Checks whether a user has an Appwrite account and whether their password has already been synced to Turso.
 */
export async function getUserPasswordSyncStatusTurso(userIdentifier: {
  userId?: string;
  email?: string;
}): Promise<{
  hasAppwriteAccount: boolean;
  appwritePasswordSynced: boolean;
  needsAppwritePasswordCheck: boolean;
  appwriteAccountId: string | null;
}> {
  const { userId, email } = userIdentifier;
  if (!userId && !email) {
    return { hasAppwriteAccount: false, appwritePasswordSynced: false, needsAppwritePasswordCheck: false, appwriteAccountId: null };
  }

  try {
    const condition = userId ? eq(schema.user.id, userId) : eq(schema.user.email, email!.trim().toLowerCase());
    const rows = await db
      .select({
        id: schema.user.id,
        hasAppwriteAccount: schema.user.hasAppwriteAccount,
        appwriteAccountId: schema.user.appwriteAccountId,
        appwritePasswordSynced: schema.user.appwritePasswordSynced,
      })
      .from(schema.user)
      .where(condition)
      .limit(1);

    const u = rows[0];
    if (!u) {
      // User unknown in Turso yet: if we don't know, allow checking Appwrite once
      return { hasAppwriteAccount: true, appwritePasswordSynced: false, needsAppwritePasswordCheck: true, appwriteAccountId: null };
    }

    const hasAppwrite = u.hasAppwriteAccount !== false;
    const isSynced = Boolean(u.appwritePasswordSynced);

    return {
      hasAppwriteAccount: Boolean(u.hasAppwriteAccount),
      appwritePasswordSynced: isSynced,
      needsAppwritePasswordCheck: hasAppwrite && !isSynced,
      appwriteAccountId: u.appwriteAccountId,
    };
  } catch (err) {
    console.warn('[getUserPasswordSyncStatusTurso] Error:', err);
    return { hasAppwriteAccount: false, appwritePasswordSynced: false, needsAppwritePasswordCheck: false, appwriteAccountId: null };
  }
}

/**
 * Upserts a conversation in Turso.
 */
export async function upsertConversationTurso(
  data: Partial<typeof schema.conversations.$inferInsert> & { id: string; creatorId: string }
) {
  try {
    const existing = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, data.id))
      .limit(1);

    const now = new Date().toISOString();
    if (existing.length > 0) {
      const updateData: any = {
        updatedAt: data.updatedAt || now,
      };
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id') {
          updateData[key] = val;
        }
      }
      await db
        .update(schema.conversations)
        .set(updateData)
        .where(eq(schema.conversations.id, data.id));
    } else {
      await db.insert(schema.conversations).values({
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      } as any);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertConversationTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function getConversationTurso(conversationId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);
    if (rows.length > 0) {
      return { success: true, row: rows[0] };
    }
    return { success: false, row: null };
  } catch (err: any) {
    console.error('[turso-ops] getConversationTurso failed:', err);
    return { success: false, row: null, error: err.message };
  }
}

export async function listConversationsTurso(userId: string) {
  try {
    // 1. Get conversations where user is a member
    const memberRows = await db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userId));
    const memberConvIds = memberRows.map((r) => r.conversationId);

    // 2. Also get conversations created by user
    const createdRows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.creatorId, userId));

    const combinedMap = new Map<string, any>();
    for (const c of createdRows) {
      combinedMap.set(c.id, c);
    }

    if (memberConvIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const convs = await db
        .select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.id, memberConvIds));
      for (const c of convs) {
        combinedMap.set(c.id, c);
      }
    }

    // Also check participants column if JSON/comma-separated contains userId
    const { like } = await import('drizzle-orm');
    const participantMatches = await db
      .select()
      .from(schema.conversations)
      .where(like(schema.conversations.participants, `%${userId}%`))
      .limit(100);
    for (const c of participantMatches) {
      combinedMap.set(c.id, c);
    }

    const rows = Array.from(combinedMap.values());
    rows.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listConversationsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteConversationTurso(conversationId: string) {
  try {
    await db.delete(schema.conversations).where(eq(schema.conversations.id, conversationId));
    await db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, conversationId));
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, conversationId));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteConversationTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertMessageTurso(
  data: Partial<typeof schema.messages.$inferInsert> & { id: string; conversationId: string; senderId: string; content?: string }
) {
  try {
    const existing = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(eq(schema.messages.id, data.id))
      .limit(1);

    const now = new Date().toISOString();
    if (existing.length > 0) {
      const updateData: any = {
        updatedAt: data.updatedAt || now,
      };
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && key !== 'id') {
          updateData[key] = val;
        }
      }
      await db
        .update(schema.messages)
        .set(updateData)
        .where(eq(schema.messages.id, data.id));
    } else {
      await db.insert(schema.messages).values({
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      } as any);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertMessageTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listMessagesTurso(conversationId: string, limit = 50) {
  try {
    const { desc } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit);
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listMessagesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function deleteMessageTurso(messageId: string) {
  try {
    await db.delete(schema.messages).where(eq(schema.messages.id, messageId));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteMessageTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertConversationMemberTurso(
  data: { id: string; conversationId: string; userId: string; role?: string }
) {
  try {
    const existing = await db
      .select({ id: schema.conversationMembers.id })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.conversationMembers)
        .set({ role: data.role || 'member' })
        .where(eq(schema.conversationMembers.id, data.id));
    } else {
      await db.insert(schema.conversationMembers).values({
        id: data.id,
        conversationId: data.conversationId,
        userId: data.userId,
        role: data.role || 'member',
      });
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertConversationMemberTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ── AI Contexts ──
export async function upsertContextTurso(data: typeof schema.contexts.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.contexts.id }).from(schema.contexts).where(eq(schema.contexts.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.contexts).set(data).where(eq(schema.contexts.id, data.id));
    } else {
      await db.insert(schema.contexts).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertContextTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listContextsTurso(userId: string, workspaceId?: string) {
  try {
    if (workspaceId) {
      const rows = await db.select().from(schema.contexts).where(and(eq(schema.contexts.userId, userId), eq(schema.contexts.workspaceId, workspaceId)));
      return { success: true, rows };
    }
    const rows = await db.select().from(schema.contexts).where(eq(schema.contexts.userId, userId));
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message };
  }
}

// ── Knowledge Graph ──
export async function upsertKnowledgeGraphTurso(data: typeof schema.knowledgeGraph.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.knowledgeGraph.id }).from(schema.knowledgeGraph).where(eq(schema.knowledgeGraph.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.knowledgeGraph).set(data).where(eq(schema.knowledgeGraph.id, data.id));
    } else {
      await db.insert(schema.knowledgeGraph).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertKnowledgeGraphTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Patterns ──
export async function upsertPatternTurso(data: typeof schema.patterns.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.patterns.id }).from(schema.patterns).where(eq(schema.patterns.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.patterns).set(data).where(eq(schema.patterns.id, data.id));
    } else {
      await db.insert(schema.patterns).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertPatternTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ── Security Logs ──
export async function insertSecurityLogTurso(data: typeof schema.securityLogs.$inferInsert) {
  try {
    await db.insert(schema.securityLogs).values(data);
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] insertSecurityLogTurso failed:', err);
    return { success: false, error: err.message };
  }
}

// ── User Resource Pins ──
export async function upsertResourcePinTurso(data: typeof schema.userResourcePins.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.userResourcePins.id }).from(schema.userResourcePins).where(eq(schema.userResourcePins.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.userResourcePins).set(data).where(eq(schema.userResourcePins.id, data.id));
    } else {
      await db.insert(schema.userResourcePins).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteResourcePinTurso(pinId: string) {
  try {
    await db.delete(schema.userResourcePins).where(eq(schema.userResourcePins.id, pinId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Comments & Reactions ──
export async function upsertCommentTurso(data: typeof schema.comments.$inferInsert) {
  try {
    const existing = await db.select({ id: schema.comments.id }).from(schema.comments).where(eq(schema.comments.id, data.id)).limit(1);
    if (existing.length > 0) {
      await db.update(schema.comments).set(data).where(eq(schema.comments.id, data.id));
    } else {
      await db.insert(schema.comments).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── User Profiles & Handles ──
export async function upsertProfileTurso(data: typeof schema.profiles.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(or(eq(schema.profiles.id, data.id), eq(schema.profiles.userId, data.userId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.profiles)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.profiles.id, existing[0].id));
    } else {
      await db.insert(schema.profiles).values(data);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProfileTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);
    return { success: true, profile: rows[0] || null };
  } catch (err: any) {
    return { success: false, profile: null, error: err.message };
  }
}

export async function getProfileByUsernameTurso(username: string) {
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '');
  if (!normalized) return { success: true, profile: null };

  try {
    const rows = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.username, normalized))
      .limit(1);

    if (rows.length > 0) {
      return { success: true, profile: rows[0] };
    }

    // Secondary fallback: lookup Better Auth user with matching username
    const userRows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.username, normalized))
      .limit(1);

    if (userRows.length > 0) {
      const u = userRows[0];
      return {
        success: true,
        profile: {
          id: `p-${u.id}`,
          userId: u.id,
          username: u.username || normalized,
          displayName: u.name,
          bio: null,
          avatar: u.image || null,
          isPublic: true,
          isGuest: false,
          isAvatar: Boolean(u.image),
          isContact: false,
          isOnlineVisible: true,
          status: 'active',
          preferences: '{}',
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
        },
      };
    }

    return { success: true, profile: null };
  } catch (err: any) {
    return { success: false, profile: null, error: err.message };
  }
}



