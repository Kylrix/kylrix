'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

/**
 * Consolidates duplicate user entries matching the same email into a single canonical user ID.
 * Re-links accounts, sessions, and domain resources to ensure seamless data access across all auth methods.
 */
export async function consolidateUserByEmail(
  email: string,
  candidateData?: { id?: string; name?: string; image?: string | null; emailVerified?: boolean }
) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    let matchingUsers = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, normalizedEmail));

    if (candidateData?.id) {
      const userById = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, candidateData.id))
        .limit(1);

      if (userById.length > 0) {
        const u = userById[0];
        if (u.email && u.email.trim().toLowerCase() === normalizedEmail) {
          if (!matchingUsers.some((x) => x.id === u.id)) {
            matchingUsers.push(u);
          }
        }
      }
    }

    if (!matchingUsers.length) {
      if (!candidateData?.id) return null;
      const now = new Date();
      const newUser = {
        id: candidateData.id,
        name: candidateData.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        emailVerified: Boolean(candidateData.emailVerified),
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.user).values(newUser).onConflictDoNothing();
      return newUser;
    }

    if (candidateData?.id && !matchingUsers.some((u) => u.id === candidateData.id)) {
      const now = new Date();
      await db.insert(schema.user).values({
        id: candidateData.id,
        name: candidateData.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        emailVerified: Boolean(candidateData.emailVerified),
        image: candidateData.image || null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      const candidateUser = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, candidateData.id))
        .limit(1);
      if (candidateUser.length > 0) matchingUsers.push(candidateUser[0]);
    }

    let canonicalUser = candidateData?.id
      ? matchingUsers.find((u) => u.id === candidateData.id) || matchingUsers[0]
      : matchingUsers[0];
    if (!candidateData?.id) {
      for (const u of matchingUsers) {
        const uCreated = u.createdAt ? new Date(u.createdAt).getTime() : Date.now();
        const canCreated = canonicalUser.createdAt ? new Date(canonicalUser.createdAt).getTime() : Date.now();
        if (uCreated < canCreated) {
          canonicalUser = u;
        }
      }
    }

    const canonicalId = canonicalUser.id;
    const duplicateUsers = matchingUsers.filter((u) => u.id !== canonicalId);

    if (duplicateUsers.length > 0) {
      const duplicateIds = duplicateUsers.map((u) => u.id);
      const { inArray } = await import('drizzle-orm');

      for (const dupId of duplicateIds) {
        const dupAccounts = await db
          .select()
          .from(schema.account)
          .where(eq(schema.account.userId, dupId));

        for (const acc of dupAccounts) {
          const existingAcc = await db
            .select({ id: schema.account.id })
            .from(schema.account)
            .where(
              and(
                eq(schema.account.userId, canonicalId),
                eq(schema.account.providerId, acc.providerId)
              )
            )
            .limit(1);

          if (existingAcc.length > 0) {
            await db.delete(schema.account).where(eq(schema.account.id, acc.id)).catch(() => {});
          } else {
            await db
              .update(schema.account)
              .set({ userId: canonicalId, updatedAt: new Date() })
              .where(eq(schema.account.id, acc.id))
              .catch(() => {});
          }
        }
      }

      await db.update(schema.session).set({ userId: canonicalId }).where(inArray(schema.session.userId, duplicateIds)).catch(() => {});
      await db.update(schema.notes).set({ userId: canonicalId }).where(inArray(schema.notes.userId, duplicateIds)).catch(() => {});
      await db.update(schema.goals).set({ userId: canonicalId }).where(inArray(schema.goals.userId, duplicateIds)).catch(() => {});
      await db.update(schema.projects).set({ creatorId: canonicalId }).where(inArray(schema.projects.creatorId, duplicateIds)).catch(() => {});
      await db.update(schema.projectObjects).set({ userId: canonicalId }).where(inArray(schema.projectObjects.userId, duplicateIds)).catch(() => {});
      await db.update(schema.vaultItems).set({ userId: canonicalId }).where(inArray(schema.vaultItems.userId, duplicateIds)).catch(() => {});
      await db.update(schema.totpSecrets).set({ userId: canonicalId }).where(inArray(schema.totpSecrets.userId, duplicateIds)).catch(() => {});
      await db.update(schema.keychain).set({ userId: canonicalId }).where(inArray(schema.keychain.userId, duplicateIds)).catch(() => {});
      await db.update(schema.forms).set({ userId: canonicalId }).where(inArray(schema.forms.userId, duplicateIds)).catch(() => {});
      await db.update(schema.events).set({ userId: canonicalId }).where(inArray(schema.events.userId, duplicateIds)).catch(() => {});
      await db.update(schema.agenticSessions).set({ userId: canonicalId }).where(inArray(schema.agenticSessions.userId, duplicateIds)).catch(() => {});
      await db.update(schema.conversations).set({ creatorId: canonicalId }).where(inArray(schema.conversations.creatorId, duplicateIds)).catch(() => {});
      await db.update(schema.subscriptions).set({ userId: canonicalId }).where(inArray(schema.subscriptions.userId, duplicateIds)).catch(() => {});

      const existingSettings = await db.select({ id: schema.userSettings.id }).from(schema.userSettings).where(eq(schema.userSettings.userId, canonicalId)).limit(1);
      if (existingSettings.length > 0) {
        await db.delete(schema.userSettings).where(inArray(schema.userSettings.userId, duplicateIds)).catch(() => {});
      } else {
        await db.update(schema.userSettings).set({ userId: canonicalId }).where(inArray(schema.userSettings.userId, duplicateIds)).catch(() => {});
      }

      const existingProfile = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.userId, canonicalId)).limit(1);
      if (existingProfile.length > 0) {
        await db.delete(schema.profiles).where(inArray(schema.profiles.userId, duplicateIds)).catch(() => {});
      } else {
        await db.update(schema.profiles).set({ userId: canonicalId }).where(inArray(schema.profiles.userId, duplicateIds)).catch(() => {});
      }

      for (const dupId of duplicateIds) {
        await db.update(schema.wallets).set({ ownerId: `user:${canonicalId}` }).where(eq(schema.wallets.ownerId, `user:${dupId}`)).catch(() => {});
        await db.update(schema.wallets).set({ ownerId: canonicalId }).where(eq(schema.wallets.ownerId, dupId)).catch(() => {});
      }

      await db
        .update(schema.user)
        .set({
          name: candidateData?.name || canonicalUser.name,
          email: normalizedEmail,
          emailVerified: Boolean(candidateData?.emailVerified ?? canonicalUser.emailVerified),
          image: candidateData?.image || canonicalUser.image || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, canonicalId));

      await db.delete(schema.user).where(inArray(schema.user.id, duplicateIds)).catch(() => {});
    } else if (candidateData) {
      await db
        .update(schema.user)
        .set({
          name: candidateData.name || canonicalUser.name,
          email: normalizedEmail,
          emailVerified: Boolean(candidateData.emailVerified ?? canonicalUser.emailVerified),
          image: candidateData.image || canonicalUser.image || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, canonicalId));
    }

    const freshRows = await db.select().from(schema.user).where(eq(schema.user.id, canonicalId)).limit(1);
    return freshRows[0] || canonicalUser;
  } catch (err: any) {
    console.error('[turso-ops] consolidateUserByEmail error:', err);
    return null;
  }
}

const userSyncCache = new Map<string, number>();
const USER_SYNC_TTL_MS = 10 * 60 * 1000;

/**
 * Ensures a user exists in Turso/Better Auth table.
 */
export async function ensureBetterAuthUserTurso(data: {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
}) {
  try {
    const now = Date.now();
    const lastSync = userSyncCache.get(data.id);
    if (lastSync && now - lastSync < USER_SYNC_TTL_MS) {
      return { success: true, user: { id: data.id } };
    }

    const consolidated = await consolidateUserByEmail(data.email, {
      id: data.id,
      name: data.name,
      image: data.image,
      emailVerified: data.emailVerified,
    });

    if (consolidated) {
      userSyncCache.set(data.id, Date.now());
      return {
        success: true,
        user: {
          id: consolidated.id,
        },
      };
    }

    return { success: false, error: 'User consolidation failed' };
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

export async function resolveUserAppwriteMigrationGate(_userIdentifier: {
  userId?: string;
  email?: string;
}): Promise<{
  shouldSkipAppwrite: boolean;
  hasAppwriteAccount: boolean;
  appwriteAccountId: string | null;
  appwriteFullySynced: boolean;
}> {
  return { shouldSkipAppwrite: true, hasAppwriteAccount: false, appwriteAccountId: null, appwriteFullySynced: true };
}

export async function syncTier1FromAppwriteTurso(_userId: string, _force = false, _jwt?: string) {
  return { success: true, alreadySynced: true, skipped: true };
}

export async function syncTier2FromAppwriteTurso(_userId: string, _force = false) {
  return { success: true, alreadySynced: true, skipped: true };
}

export async function checkAndSyncAppwritePasswordToBetterAuth(_params: {
  email: string;
  password: string;
  appwriteUserId?: string;
}) {
  return { synced: false, hasExistingBetterAuthPassword: true };
}

export async function getUserPasswordSyncStatusTurso(_userIdentifier: {
  userId?: string;
  email?: string;
}) {
  return {
    hasAppwriteAccount: false,
    appwritePasswordSynced: true,
    needsAppwritePasswordCheck: false,
    appwriteAccountId: null,
  };
}

// ========================================================
// TURSO KEYCHAIN, VAULT, WORKSPACES, DOMAIN OPS
// ========================================================

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

import { normalizeKeychainRow as normalizeKeychainRowSync } from '@/lib/vault/normalize-keychain';

export async function normalizeKeychainRow(row: any): Promise<any> {
  return normalizeKeychainRowSync(row);
}

export async function listKeychainTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.keychain)
      .where(eq(schema.keychain.userId, userId));
    const normalizedRows = Array.isArray(rows) ? rows.map(normalizeKeychainRowSync) : [];
    return { success: true, rows: normalizedRows };
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
    const normalizedRows = rows.map((row: any) => {
      let nested = row.metadata;
      for (let i = 0; i < 3 && typeof nested === 'string'; i += 1) {
        try { nested = JSON.parse(nested); } catch { break; }
      }
      const fields = nested && typeof nested === 'object' ? nested : {};
      return {
        ...row,
        $id: row.id,
        name: fields.name || row.title,
        username: fields.username || '',
        url: fields.url || '',
        password: fields.password || '',
        notes: fields.notes || '',
        type: fields.itemType || row.type,
        dek: fields.dek || row.dek || null,
      };
    });
    return { success: true, rows: normalizedRows };
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
    const normalizedRows = rows.map((row: any) => ({
      ...row,
      $id: row.id,
      secretKey: row.encryptedSecret,
      accountName: row.account,
      issuer: (() => {
        if (!row.metadata) return '';
        try { return JSON.parse(row.metadata)?.issuer || ''; } catch { return ''; }
      })(),
    }));
    return { success: true, rows: normalizedRows };
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
    const ownedRows = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.creatorId, userId));
    const memberships = await db
      .select({ workspaceId: schema.projectObjects.workspaceId })
      .from(schema.projectObjects)
      .where(eq(schema.projectObjects.userId, userId));
    const memberIds = memberships.map((row) => row.workspaceId).filter(Boolean);
    const sharedRows = memberIds.length
      ? await db.select().from(schema.projects).where(inArray(schema.projects.id, memberIds))
      : [];
    const rows = Array.from(new Map(
      [...ownedRows, ...sharedRows].map((row) => [row.id, row]),
    ).values());
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listWorkspacesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function getWorkspaceTurso(id: string) {
  try {
    const rows = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);
    if (rows.length === 0) return { success: false, workspace: null };
    return { success: true, workspace: rows[0] };
  } catch (err: any) {
    console.error('[turso-ops] getWorkspaceTurso failed:', err);
    return { success: false, workspace: null, error: err.message };
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

export async function upsertNoteTurso(data: typeof schema.notes.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.notes.id })
      .from(schema.notes)
      .where(eq(schema.notes.id, data.id))
      .limit(1);

    let isCreate = false;
    let shapedPayload: any = null;

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
      shapedPayload = { $id: data.id, ...updateData };
    } else {
      isCreate = true;
      await db.insert(schema.notes).values(data);
      shapedPayload = { $id: data.id, ...data };
    }

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      await broadcastRealtimeEvent({
        databaseId: 'turso',
        tableId: 'ideas',
        rowId: data.id,
        action: isCreate ? 'create' : 'update',
        payload: shapedPayload,
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertNoteTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteNoteTurso(noteId: string) {
  try {
    const updatedAt = new Date().toISOString();
    await db
      .update(schema.notes)
      .set({ isTrashed: true, updatedAt })
      .where(eq(schema.notes.id, noteId));

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      await broadcastRealtimeEvent({
        databaseId: 'turso',
        tableId: 'ideas',
        rowId: noteId,
        action: 'delete',
        payload: { $id: noteId, id: noteId, isDeleted: true, isTrash: true, updatedAt },
      }).catch(() => {});
    } catch {}

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

export async function upsertGoalTurso(
  data: Partial<typeof schema.goals.$inferInsert> & { id: string; userId: string; title: string }
) {
  try {
    const existing = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.id, data.id))
      .limit(1);

    let isCreate = false;
    let shapedPayload: any = null;

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
      shapedPayload = { $id: data.id, ...updateData };
    } else {
      isCreate = true;
      shapedPayload = {
        ...data,
        $id: data.id,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      await db.insert(schema.goals).values(shapedPayload as any);
    }

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      await broadcastRealtimeEvent({
        tableId: 'tasks',
        rowId: data.id,
        action: isCreate ? 'create' : 'update',
        payload: shapedPayload,
      }).catch(() => {});
    } catch {}

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
    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      await broadcastRealtimeEvent({
        tableId: 'tasks',
        rowId: goalId,
        action: 'delete',
        payload: { id: goalId, $id: goalId, isTrash: true, isDeleted: true },
      }).catch(() => {});
    } catch {}
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

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
    const memberRows = await db
      .select({ conversationId: schema.conversationMembers.conversationId })
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.userId, userId));
    const memberConvIds = memberRows.map((r) => r.conversationId);

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

export async function insertSecurityLogTurso(data: typeof schema.securityLogs.$inferInsert) {
  try {
    await db.insert(schema.securityLogs).values(data);
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] insertSecurityLogTurso failed:', err);
    return { success: false, error: err.message };
  }
}

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
