'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import { invalidateRowCache } from '@/lib/actions/secure-ops/shared';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const queryTTLMs = 60000; // 60 seconds short TTL for list queries with write-invalidation
const resourceCache = new Map<string, CacheEntry<any>>();

export async function invalidateResourceCache(keyPrefix?: string, userId?: string, rowId?: string) {
  if (!keyPrefix && !userId && !rowId) {
    resourceCache.clear();
    await invalidateRowCache();
    return;
  }
  for (const key of resourceCache.keys()) {
    if (keyPrefix && key.startsWith(keyPrefix)) {
      if (!userId || key.includes(`:${userId}`)) {
        resourceCache.delete(key);
      }
    } else if (userId && key.includes(`:${userId}`)) {
      resourceCache.delete(key);
    }
  }

  if (rowId) {
    await invalidateRowCache(undefined, rowId);
  }
  if (keyPrefix) {
    const tableMap: Record<string, string> = {
      notes: 'ideas',
      ideas: 'ideas',
      goals: 'tasks',
      tasks: 'tasks',
      vault: 'credentials',
      credentials: 'credentials',
      totp: 'totpSecrets',
      workspaces: 'projects',
      projects: 'projects',
      forms: 'forms',
      events: 'events',
    };
    await invalidateRowCache(tableMap[keyPrefix] || keyPrefix, rowId);
  }
}

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
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.keychain).values(payload).onConflictDoUpdate({
      target: schema.keychain.id,
      set: payload,
    });
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

/**
 * Resolves canonical user IDs for a user using indexed lookups (id PK, email index, account userId)
 * to bridge fragmented user accounts across OAuth providers and legacy Appwrite migrations.
 */
export async function resolveAllUserIds(userId: string): Promise<string[]> {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return [];

  const allUserIds = new Set<string>([cleanId]);
  const emailsToQuery = new Set<string>();

  if (cleanId.includes('@')) {
    emailsToQuery.add(cleanId.toLowerCase());
  }

  try {
    const { sql } = await import('drizzle-orm');

    // 1. Fetch primary user record by ID, appwriteAccountId, or email, and account records by userId or accountId
    const userConditions = [
      eq(schema.user.id, cleanId),
      eq(schema.user.appwriteAccountId, cleanId),
    ];
    if (cleanId.includes('@')) {
      userConditions.push(eq(schema.user.email, cleanId.toLowerCase()));
    }

    const [matchedUsers, initialAccounts] = await Promise.all([
      db
        .select({
          id: schema.user.id,
          appwriteAccountId: schema.user.appwriteAccountId,
          email: schema.user.email,
        })
        .from(schema.user)
        .where(or(...userConditions))
        .limit(20),
      db
        .select({
          userId: schema.account.userId,
          accountId: schema.account.accountId,
        })
        .from(schema.account)
        .where(
          or(
            eq(schema.account.userId, cleanId),
            eq(schema.account.accountId, cleanId)
          )
        )
        .limit(20),
    ]);

    for (const u of matchedUsers) {
      if (u.id) allUserIds.add(u.id);
      if (u.appwriteAccountId) allUserIds.add(u.appwriteAccountId);
      if (u.email?.trim()) emailsToQuery.add(u.email.trim().toLowerCase());
    }

    for (const acc of initialAccounts) {
      if (acc.userId) allUserIds.add(acc.userId);
      if (acc.accountId) allUserIds.add(acc.accountId);
    }

    // 2. Fetch user records for any newly discovered user IDs from initialAccounts
    const currentIdsForUserLookup = Array.from(allUserIds).filter(Boolean);
    if (currentIdsForUserLookup.length > 0) {
      const secondaryUsers = await db
        .select({
          id: schema.user.id,
          appwriteAccountId: schema.user.appwriteAccountId,
          email: schema.user.email,
        })
        .from(schema.user)
        .where(
          or(
            inArray(schema.user.id, currentIdsForUserLookup),
            inArray(schema.user.appwriteAccountId, currentIdsForUserLookup)
          )
        )
        .limit(50);

      for (const u of secondaryUsers) {
        if (u.id) allUserIds.add(u.id);
        if (u.appwriteAccountId) allUserIds.add(u.appwriteAccountId);
        if (u.email?.trim()) emailsToQuery.add(u.email.trim().toLowerCase());
      }
    }

    // 3. Query all user IDs from schema.user sharing that normalized email address (LOWER(email))
    if (emailsToQuery.size > 0) {
      for (const email of emailsToQuery) {
        const sharedEmailUsers = await db
          .select({
            id: schema.user.id,
            appwriteAccountId: schema.user.appwriteAccountId,
            email: schema.user.email,
          })
          .from(schema.user)
          .where(sql`LOWER(${schema.user.email}) = ${email.toLowerCase()}`)
          .limit(50);

        for (const sharedU of sharedEmailUsers) {
          if (sharedU.id) allUserIds.add(sharedU.id);
          if (sharedU.appwriteAccountId) allUserIds.add(sharedU.appwriteAccountId);
          if (sharedU.email?.trim()) emailsToQuery.add(sharedU.email.trim().toLowerCase());
        }
      }
    }

    // 3. Query schema.account for all account.userId rows matching ANY of those user IDs OR accountId matching any linked social provider ID
    const currentResolved = Array.from(allUserIds).filter(Boolean);
    if (currentResolved.length > 0) {
      const accountRows = await db
        .select({ userId: schema.account.userId, accountId: schema.account.accountId })
        .from(schema.account)
        .where(
          or(
            inArray(schema.account.userId, currentResolved),
            inArray(schema.account.accountId, currentResolved)
          )
        )
        .limit(50);

      for (const acc of accountRows) {
        if (acc.userId) allUserIds.add(acc.userId);
        if (acc.accountId) allUserIds.add(acc.accountId);
      }
    }

    // 4. Query workspaceMembers and collaborators for any linked user IDs
    const finalResolved = Array.from(allUserIds).filter(Boolean);
    if (finalResolved.length > 0) {
      const [memberUsers, collabUsers] = await Promise.all([
        db
          .select({ userId: schema.workspaceMembers.userId })
          .from(schema.workspaceMembers)
          .where(inArray(schema.workspaceMembers.userId, finalResolved))
          .limit(50),
        db
          .select({ userId: schema.collaborators.userId })
          .from(schema.collaborators)
          .where(inArray(schema.collaborators.userId, finalResolved))
          .limit(50),
      ]);

      for (const m of memberUsers) {
        if (m.userId) allUserIds.add(m.userId);
      }
      for (const c of collabUsers) {
        if (c.userId) allUserIds.add(c.userId);
      }
    }
  } catch (err) {
    console.warn('[turso-ops] resolveAllUserIds warning:', err);
  }

  return Array.from(allUserIds).filter(Boolean);
}

export async function listKeychainTurso(userId: string) {
  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.keychain)
      .where(inArray(schema.keychain.userId, allUserIds));
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

export async function upsertVaultItemTurso(data: any) {
  try {
    const rawData = data || {};
    const vaultItemId = rawData.id || rawData.$id;
    invalidateResourceCache('vault', rawData.userId, vaultItemId);
    const titleVal = rawData.title || rawData.name || 'Untitled Secret';
    const typeVal = rawData.type || rawData.itemType || 'login';
    const encryptedDataVal = rawData.encrypted_data || rawData.encryptedData || rawData.password || rawData.secret || '';
    let ivVal = rawData.iv && String(rawData.iv).trim() !== '' ? String(rawData.iv).trim() : null;
    if (!ivVal) {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        ivVal = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      } else {
        ivVal = '000000000000000000000000';
      }
    }
    const isTrashedVal = Boolean(rawData.isTrashed ?? rawData.isDeleted ?? rawData.isTrash ?? false);
    const isWorkspaceVal = Boolean(rawData.isWorkspace ?? false);
    const workspaceIdVal = rawData.workspaceId || rawData.projectId || null;

    let metaObj: Record<string, any> = {};
    if (typeof rawData.metadata === 'string') {
      try { metaObj = JSON.parse(rawData.metadata); } catch { metaObj = {}; }
    } else if (rawData.metadata && typeof rawData.metadata === 'object') {
      metaObj = { ...rawData.metadata };
    }

    const extraFields = [
      'name', 'username', 'password', 'url', 'notes', 'customFields',
      'itemType', 'tags', 'folderId', 'totpId', 'cardNumber', 'cardholderName',
      'cardExpiry', 'cardCVV', 'cardPIN', 'cardType', 'isFavorite', 'isPinned',
      'isEnv', 'dek', 'faviconUrl', 'attachments'
    ];
    for (const field of extraFields) {
      if (rawData[field] !== undefined && !(field in metaObj)) {
        metaObj[field] = rawData[field];
      }
    }

    const payload: typeof schema.vaultItems.$inferInsert = {
      id: rawData.id || rawData.$id,
      userId: rawData.userId,
      title: titleVal,
      type: typeVal,
      encryptedData: encryptedDataVal,
      iv: ivVal,
      metadata: JSON.stringify(metaObj),
      isTrashed: isTrashedVal,
      isWorkspace: isWorkspaceVal,
      workspaceId: workspaceIdVal,
      createdAt: rawData.createdAt || new Date().toISOString(),
      updatedAt: rawData.updatedAt || new Date().toISOString(),
    };

    await db.insert(schema.vaultItems).values(payload).onConflictDoUpdate({
      target: schema.vaultItems.id,
      set: { ...payload, updatedAt: payload.updatedAt || new Date().toISOString() },
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'credentials',
        rowId: payload.id,
        action: 'update',
        payload: { $id: payload.id, ...payload },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export const listVaultItemsTurso = cache(async function listVaultItemsTurso(userId: string) {
  const cacheKey = `vault:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.vaultItems)
      .where(and(inArray(schema.vaultItems.userId, allUserIds), eq(schema.vaultItems.isTrashed, false)));
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
        password: fields.password || row.encryptedData || '',
        notes: fields.notes || '',
        customFields: fields.customFields || '',
        type: fields.itemType || row.type,
        dek: fields.dek || row.dek || null,
        isFavorite: fields.isFavorite ?? false,
        isPinned: fields.isPinned ?? false,
        isPublic: fields.isPublic ?? false,
        isGuest: fields.isGuest ?? false,
        isShared: fields.isShared ?? false,
        tags: fields.tags || [],
        folderId: fields.folderId || null,
        totpId: fields.totpId || null,
        projectId: row.workspaceId || fields.projectId || null,
        isWorkspace: Boolean(row.isWorkspace || fields.isWorkspace),
        cardNumber: fields.cardNumber || null,
        cardholderName: fields.cardholderName || null,
        cardExpiry: fields.cardExpiry || null,
        cardCVV: fields.cardCVV || null,
        cardPIN: fields.cardPIN || null,
        cardType: fields.cardType || null,
      };
    });
    const result = { success: true, rows: normalizedRows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listVaultItemsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

export async function deleteVaultItemTurso(id: string) {
  try {
    invalidateResourceCache('vault', undefined, id);
    await db
      .update(schema.vaultItems)
      .set({ isTrashed: true, updatedAt: new Date().toISOString() })
      .where(eq(schema.vaultItems.id, id));

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'credentials',
        rowId: id,
        action: 'delete',
        payload: { $id: id, id, isTrashed: true, isDeleted: true },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertTotpSecretTurso(data: any) {
  try {
    const rawData = data || {};
    const totpId = rawData.id || rawData.$id;
    invalidateResourceCache('totp', rawData.userId, totpId);
    const accountVal = rawData.account || rawData.accountName || 'Account';
    const encryptedSecretVal = rawData.encryptedSecret || rawData.secretKey || rawData.secret || '';

    let metaObj: Record<string, any> = {};
    if (typeof rawData.metadata === 'string') {
      try { metaObj = JSON.parse(rawData.metadata); } catch { metaObj = {}; }
    } else if (rawData.metadata && typeof rawData.metadata === 'object') {
      metaObj = { ...rawData.metadata };
    }

    const extraFields = [
      'accountName', 'issuer', 'algorithm', 'digits', 'period', 'url',
      'folderId', 'tags', 'dek', 'isPinned', 'isFavorite', 'isPublic', 'isGuest', 'isShared'
    ];
    for (const field of extraFields) {
      if (rawData[field] !== undefined && !(field in metaObj)) {
        metaObj[field] = rawData[field];
      }
    }

    const payload: typeof schema.totpSecrets.$inferInsert = {
      id: rawData.id || rawData.$id,
      userId: rawData.userId,
      account: accountVal,
      encryptedSecret: encryptedSecretVal,
      metadata: JSON.stringify(metaObj),
      createdAt: rawData.createdAt || new Date().toISOString(),
    };

    await db.insert(schema.totpSecrets).values(payload).onConflictDoUpdate({
      target: schema.totpSecrets.id,
      set: payload,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'totpSecrets',
        rowId: payload.id,
        action: 'update',
        payload: { $id: payload.id, ...payload },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertTotpSecretTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export const listTotpSecretsTurso = cache(async function listTotpSecretsTurso(userId: string) {
  const cacheKey = `totp:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.totpSecrets)
      .where(inArray(schema.totpSecrets.userId, allUserIds));
    const normalizedRows = rows.map((row: any) => {
      let meta: any = {};
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch {}
      return {
        ...row,
        $id: row.id,
        secretKey: row.encryptedSecret || meta.secretKey || '',
        accountName: meta.accountName || row.account,
        issuer: meta.issuer || '',
        algorithm: meta.algorithm || 'SHA1',
        digits: meta.digits || 6,
        period: meta.period || 30,
        url: meta.url || '',
        folderId: meta.folderId || '',
        tags: meta.tags || [],
        dek: meta.dek || null,
        isPinned: Boolean(meta.isPinned),
        isFavorite: Boolean(meta.isFavorite),
        isPublic: Boolean(meta.isPublic),
        isGuest: Boolean(meta.isGuest),
        isShared: Boolean(meta.isShared),
      };
    });
    const result = { success: true, rows: normalizedRows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listTotpSecretsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

export async function deleteTotpSecretTurso(id: string) {
  try {
    invalidateResourceCache('totp', undefined, id);
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.id, id));

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'totpSecrets',
        rowId: id,
        action: 'delete',
        payload: { $id: id, id, isTrashed: true, isDeleted: true },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteTotpSecretTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertProjectTurso(data: Partial<typeof schema.projects.$inferInsert> & { id: string; creatorId: string; name?: string; title?: string }) {
  try {
    invalidateResourceCache('workspaces', data.creatorId);
    const now = new Date().toISOString();
    const nameVal = data.name || data.title || 'Workspace';
    const titleVal = data.title || data.name || nameVal;

    const payload: typeof schema.projects.$inferInsert = {
      id: data.id,
      creatorId: data.creatorId,
      ownerId: data.ownerId || data.creatorId,
      name: nameVal,
      title: titleVal,
      description: data.description || data.summary || '',
      summary: data.summary || data.description || '',
      slug: data.slug || null,
      inviteCode: data.inviteCode || null,
      status: data.status || 'active',
      visibility: data.visibility || (data.isPublic ? 'public' : 'private'),
      parentProjectId: data.parentProjectId || null,
      kind: data.kind || 'workspace',
      dek: data.dek || null,
      isPublic: Boolean(data.isPublic),
      isAgentic: Boolean(data.isAgentic),
      isExternal: Boolean(data.isExternal),
      externalClient: data.externalClient || null,
      isLocked: Boolean(data.isLocked),
      privacyMode: Boolean(data.privacyMode),
      metadata: data.metadata || null,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    const { id: _id, createdAt: _ca, ...updateData } = payload;
    await db.insert(schema.projects).values(payload).onConflictDoUpdate({
      target: schema.projects.id,
      set: { ...updateData, updatedAt: now },
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertProjectTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteWorkspaceTurso(workspaceId: string) {
  try {
    invalidateResourceCache('workspaces');
    await db.delete(schema.projectObjects).where(eq(schema.projectObjects.workspaceId, workspaceId)).catch(() => {});
    await db.delete(schema.workspaceMembers).where(eq(schema.workspaceMembers.workspaceId, workspaceId)).catch(() => {});
    await db.delete(schema.collaborators).where(
      and(
        eq(schema.collaborators.resourceId, workspaceId),
        eq(schema.collaborators.resourceType, 'project')
      )
    ).catch(() => {});
    await db.delete(schema.projects).where(eq(schema.projects.id, workspaceId));
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] deleteWorkspaceTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export const listWorkspacesTurso = cache(async function listWorkspacesTurso(userId: string) {
  const cacheKey = `workspaces:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const [ownedRows, projectObjMemberships, wsMemberships, collabMemberships, publicAgenticRows] = await Promise.all([
      db
        .select()
        .from(schema.projects)
        .where(
          or(
            inArray(schema.projects.creatorId, allUserIds),
            inArray(schema.projects.ownerId, allUserIds)
          )
        ),
      db
        .select({ workspaceId: schema.projectObjects.workspaceId })
        .from(schema.projectObjects)
        .where(inArray(schema.projectObjects.userId, allUserIds)),
      db
        .select({ workspaceId: schema.workspaceMembers.workspaceId })
        .from(schema.workspaceMembers)
        .where(inArray(schema.workspaceMembers.userId, allUserIds)),
      db
        .select({ resourceId: schema.collaborators.resourceId })
        .from(schema.collaborators)
        .where(
          and(
            inArray(schema.collaborators.userId, allUserIds),
            eq(schema.collaborators.resourceType, 'project')
          )
        ),
      db
        .select()
        .from(schema.projects)
        .where(
          and(
            or(
              eq(schema.projects.isAgentic, true),
              eq(schema.projects.isPublic, true)
            ),
            or(
              inArray(schema.projects.creatorId, allUserIds),
              inArray(schema.projects.ownerId, allUserIds)
            )
          )
        ),
    ]);

    const memberIds = Array.from(new Set([
      ...projectObjMemberships.map((r) => r.workspaceId),
      ...wsMemberships.map((r) => r.workspaceId),
      ...collabMemberships.map((r) => r.resourceId),
    ])).filter(Boolean);

    const sharedRows = memberIds.length
      ? await db.select().from(schema.projects).where(inArray(schema.projects.id, memberIds))
      : [];

    const combinedMap = new Map<string, any>();
    for (const r of [...ownedRows, ...sharedRows, ...publicAgenticRows]) {
      const nameVal = r.name || r.title || 'Workspace';
      const titleVal = r.title || r.name || nameVal;
      const ownerVal = r.ownerId || r.creatorId || userId;
      combinedMap.set(r.id, {
        ...r,
        $id: r.id,
        id: r.id,
        name: nameVal,
        title: titleVal,
        ownerId: ownerVal,
        creatorId: r.creatorId || ownerVal,
      });
    }

    const rows = Array.from(combinedMap.values());
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listWorkspacesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

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
    await db.insert(schema.projectObjects).values(data).onConflictDoUpdate({
      target: schema.projectObjects.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertWorkspaceObjectTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertUserSettingsTurso(data: typeof schema.userSettings.$inferInsert) {
  try {
    const updatedAt = new Date().toISOString();
    await db.insert(schema.userSettings).values({ ...data, updatedAt }).onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: {
        preferences: data.preferences,
        securityFlags: data.securityFlags,
        updatedAt,
      },
    });
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
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.threads).values(payload).onConflictDoUpdate({
      target: schema.threads.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertThreadTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertThreadMessageTurso(data: typeof schema.threadMessages.$inferInsert) {
  try {
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.threadMessages).values(payload).onConflictDoUpdate({
      target: schema.threadMessages.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertThreadMessageTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertNotesBatchTurso(items: (typeof schema.notes.$inferInsert)[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    if (items[0]?.userId) invalidateResourceCache('notes', items[0].userId);
    for (const item of items) {
      if (item?.id) invalidateResourceCache('notes', undefined, item.id);
    }
    const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');

    await db.transaction(async (tx) => {
      for (const data of items) {
        if (!data || !data.id) continue;
        const updatedAt = data.updatedAt || new Date().toISOString();
        const payload = { ...data, updatedAt };

        await tx.insert(schema.notes).values(payload).onConflictDoUpdate({
          target: schema.notes.id,
          set: payload,
        });

        void broadcastRealtimeEvent({
          databaseId: 'turso',
          tableId: 'ideas',
          rowId: data.id,
          action: 'update',
          payload: { $id: data.id, ...payload },
        }).catch(() => {});
      }
    });

    return { success: true, count: items.length };
  } catch (err: any) {
    console.error('[turso-ops] upsertNotesBatchTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertNoteTurso(data: typeof schema.notes.$inferInsert) {
  try {
    invalidateResourceCache('notes', data.userId, data.id);
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };

    await db.insert(schema.notes).values(payload).onConflictDoUpdate({
      target: schema.notes.id,
      set: payload,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        databaseId: 'turso',
        tableId: 'ideas',
        rowId: data.id,
        action: 'update',
        payload: { $id: data.id, ...payload },
      }).catch(() => {});
      void broadcastRealtimeEvent({
        databaseId: 'turso',
        tableId: 'notes',
        rowId: data.id,
        action: 'update',
        payload: { $id: data.id, ...payload },
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
    invalidateResourceCache('notes', undefined, noteId);
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

export const listNotesTurso = cache(async function listNotesTurso(userId: string) {
  const cacheKey = `notes:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.notes)
      .where(and(inArray(schema.notes.userId, allUserIds), eq(schema.notes.isTrashed, false)))
      .orderBy(desc(schema.notes.updatedAt));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listNotesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

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

export async function upsertGoalsBatchTurso(
  items: (Partial<typeof schema.goals.$inferInsert> & { id: string; userId: string; title: string })[]
) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    if (items[0]?.userId) invalidateResourceCache('goals', items[0].userId);
    const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');

    await db.transaction(async (tx) => {
      for (const data of items) {
        if (!data || !data.id) continue;
        const now = new Date().toISOString();
        const shapedPayload: any = {
          ...data,
          $id: data.id,
          createdAt: data.createdAt || now,
          updatedAt: data.updatedAt || now,
        };

        await tx.insert(schema.goals).values(shapedPayload as any).onConflictDoUpdate({
          target: schema.goals.id,
          set: shapedPayload as any,
        });

        void broadcastRealtimeEvent({
          tableId: 'tasks',
          rowId: data.id,
          action: 'update',
          payload: shapedPayload,
        }).catch(() => {});
      }
    });

    return { success: true, count: items.length };
  } catch (err: any) {
    console.error('[turso-ops] upsertGoalsBatchTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertGoalTurso(
  data: Partial<typeof schema.goals.$inferInsert> & { id: string; userId: string; title: string }
) {
  try {
    invalidateResourceCache('goals', data.userId, data.id);
    const now = new Date().toISOString();
    const shapedPayload: any = {
      ...data,
      $id: data.id,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    await db.insert(schema.goals).values(shapedPayload as any).onConflictDoUpdate({
      target: schema.goals.id,
      set: shapedPayload as any,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'tasks',
        rowId: data.id,
        action: 'update',
        payload: shapedPayload,
      }).catch(() => {});
      void broadcastRealtimeEvent({
        tableId: 'goals',
        rowId: data.id,
        action: 'update',
        payload: shapedPayload,
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export const listGoalsTurso = cache(async function listGoalsTurso(userId: string) {
  const cacheKey = `goals:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.goals)
      .where(and(inArray(schema.goals.userId, allUserIds), eq(schema.goals.isTrashed, false)))
      .orderBy(desc(schema.goals.updatedAt));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listGoalsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

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
    invalidateResourceCache('goals', undefined, goalId);
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
    invalidateResourceCache('forms', data.userId, data.id);
    await db.insert(schema.forms).values(data).onConflictDoUpdate({
      target: schema.forms.id,
      set: data,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'forms',
        rowId: data.id,
        action: 'update',
        payload: { $id: data.id, ...data },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const listFormsTurso = cache(async function listFormsTurso(userId: string) {
  const cacheKey = `forms:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);
    const wsRes = await listWorkspacesTurso(userId).catch(() => ({ rows: [] }));
    const workspaceIds = Array.isArray(wsRes?.rows)
      ? wsRes.rows.map((w: any) => w.id).filter(Boolean)
      : [];

    const conditions = [
      inArray(schema.forms.userId, allUserIds),
      inArray(schema.forms.creatorId, allUserIds),
    ];
    if (workspaceIds.length > 0) {
      conditions.push(inArray(schema.forms.workspaceId, workspaceIds));
    }

    const rows = await db
      .select()
      .from(schema.forms)
      .where(or(...conditions))
      .orderBy(desc(schema.forms.createdAt));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listFormsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

export async function upsertEventTurso(data: typeof schema.events.$inferInsert) {
  try {
    invalidateResourceCache('events', data.userId, data.id);
    await db.insert(schema.events).values(data).onConflictDoUpdate({
      target: schema.events.id,
      set: data,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      void broadcastRealtimeEvent({
        tableId: 'events',
        rowId: data.id,
        action: 'update',
        payload: { $id: data.id, ...data },
      }).catch(() => {});
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const listEventsTurso = cache(async function listEventsTurso(userId: string) {
  const cacheKey = `events:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);
    const wsRes = await listWorkspacesTurso(userId).catch(() => ({ rows: [] }));
    const workspaceIds = Array.isArray(wsRes?.rows)
      ? wsRes.rows.map((w: any) => w.id).filter(Boolean)
      : [];

    const conditions = [
      inArray(schema.events.userId, allUserIds),
      inArray(schema.events.creatorId, allUserIds),
    ];
    if (workspaceIds.length > 0) {
      conditions.push(inArray(schema.events.workspaceId, workspaceIds));
    }

    const rows = await db
      .select()
      .from(schema.events)
      .where(or(...conditions))
      .orderBy(desc(schema.events.createdAt));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listEventsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
});

export async function upsertAgenticSessionTurso(data: typeof schema.agenticSessions.$inferInsert) {
  try {
    await db.insert(schema.agenticSessions).values(data).onConflictDoUpdate({
      target: schema.agenticSessions.id,
      set: data,
    });
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
    await db.insert(schema.workflows).values(data).onConflictDoUpdate({
      target: schema.workflows.id,
      set: data,
    });
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
    await db.insert(schema.coupons).values(data).onConflictDoUpdate({
      target: schema.coupons.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCouponTurso(id: string) {
  try {
    const rows = await db.select().from(schema.coupons).where(eq(schema.coupons.id, id)).limit(1);
    if (rows.length > 0) {
      return { success: true, row: rows[0] };
    }
    return { success: false, row: null };
  } catch (err: any) {
    return { success: false, row: null, error: err.message };
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
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.subscriptions).values(payload).onConflictDoUpdate({
      target: schema.subscriptions.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertWalletTurso(data: typeof schema.wallets.$inferInsert) {
  try {
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.wallets).values(payload).onConflictDoUpdate({
      target: schema.wallets.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertKylrixTokenLedgerTurso(data: typeof schema.kylrixTokenLedger.$inferInsert) {
  try {
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.kylrixTokenLedger).values(payload).onConflictDoUpdate({
      target: schema.kylrixTokenLedger.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertTelegramConnectionTurso(data: typeof schema.telegramConnections.$inferInsert) {
  try {
    if (!data.id) return { success: false, error: 'Missing telegram connection ID' };
    const payload = {
      id: data.id,
      pairCode: data.pairCode || null,
      tgChatId: data.tgChatId || null,
      tgUsername: data.tgUsername || null,
      isVerified: Boolean(data.isVerified),
      createdAt: data.createdAt || new Date().toISOString(),
    };
    await db.insert(schema.telegramConnections).values(payload).onConflictDoUpdate({
      target: schema.telegramConnections.id,
      set: payload,
    });
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
    const now = new Date().toISOString();
    const payload: typeof schema.conversations.$inferInsert = {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    } as any;
    await db.insert(schema.conversations).values(payload).onConflictDoUpdate({
      target: schema.conversations.id,
      set: payload,
    });
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
    const now = new Date().toISOString();
    const payload: typeof schema.messages.$inferInsert = {
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    } as any;
    await db.insert(schema.messages).values(payload).onConflictDoUpdate({
      target: schema.messages.id,
      set: payload,
    });
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
    const payload = {
      id: data.id,
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role || 'member',
    };
    await db.insert(schema.conversationMembers).values(payload).onConflictDoUpdate({
      target: schema.conversationMembers.id,
      set: { role: payload.role },
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertConversationMemberTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertContextTurso(data: typeof schema.contexts.$inferInsert) {
  try {
    await db.insert(schema.contexts).values(data).onConflictDoUpdate({
      target: schema.contexts.id,
      set: data,
    });
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
    await db.insert(schema.knowledgeGraph).values(data).onConflictDoUpdate({
      target: schema.knowledgeGraph.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertKnowledgeGraphTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function upsertPatternTurso(data: typeof schema.patterns.$inferInsert) {
  try {
    await db.insert(schema.patterns).values(data).onConflictDoUpdate({
      target: schema.patterns.id,
      set: data,
    });
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
    await db.insert(schema.userResourcePins).values(data).onConflictDoUpdate({
      target: schema.userResourcePins.id,
      set: data,
    });
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
    await db.insert(schema.comments).values(data).onConflictDoUpdate({
      target: schema.comments.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertProfileTurso(data: typeof schema.profiles.$inferInsert) {
  try {
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };
    await db.insert(schema.profiles).values(payload).onConflictDoUpdate({
      target: schema.profiles.id,
      set: payload,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const getProfileTurso = cache(async function getProfileTurso(userId: string) {
  const cacheKey = `profile:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try {
    const rows = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);
    const result = { success: true, profile: rows[0] || null };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    return { success: false, profile: null, error: err.message };
  }
});

export const getProfileByUsernameTurso = cache(async function getProfileByUsernameTurso(username: string) {
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
});
