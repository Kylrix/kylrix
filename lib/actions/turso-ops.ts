'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const queryTTLMs = 3000; // 3 seconds short TTL for list queries
const resourceCache = new Map<string, CacheEntry<any>>();

export function invalidateResourceCache(keyPrefix?: string, userId?: string) {
  if (!keyPrefix && !userId) {
    resourceCache.clear();
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
async function resolveAllUserIds(userId: string): Promise<string[]> {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return [];

  const allUserIds = new Set<string>([cleanId]);
  const emailsToQuery = new Set<string>();

  if (cleanId.includes('@')) {
    emailsToQuery.add(cleanId.toLowerCase());
  }

  try {
    // 1. Look up account table entries directly linked to cleanId
    const accountRows = await db
      .select({ userId: schema.account.userId })
      .from(schema.account)
      .where(eq(schema.account.userId, cleanId))
      .limit(20);

    for (const acc of accountRows) {
      if (acc.userId) allUserIds.add(acc.userId);
    }

    // 2. Query user records by id or appwriteAccountId or email
    const userConditions = [
      eq(schema.user.id, cleanId),
      eq(schema.user.appwriteAccountId, cleanId),
    ];
    if (cleanId.includes('@')) {
      userConditions.push(eq(schema.user.email, cleanId.toLowerCase()));
    }

    const matchedUsers = await db
      .select({
        id: schema.user.id,
        appwriteAccountId: schema.user.appwriteAccountId,
        email: schema.user.email,
      })
      .from(schema.user)
      .where(or(...userConditions))
      .limit(10);

    for (const u of matchedUsers) {
      if (u.id) allUserIds.add(u.id);
      if (u.appwriteAccountId) allUserIds.add(u.appwriteAccountId);
      if (u.email) emailsToQuery.add(u.email.trim().toLowerCase());
    }

    // 3. Cross-reference all matching email addresses to find shared user records & account entries
    if (emailsToQuery.size > 0) {
      for (const email of emailsToQuery) {
        const sharedEmailUsers = await db
          .select({
            id: schema.user.id,
            appwriteAccountId: schema.user.appwriteAccountId,
          })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(20);

        for (const sharedU of sharedEmailUsers) {
          if (sharedU.id) allUserIds.add(sharedU.id);
          if (sharedU.appwriteAccountId) allUserIds.add(sharedU.appwriteAccountId);
        }
      }
    }

    // 4. Query accounts linked to any resolved user IDs in case additional accounts exist
    const currentResolved = Array.from(allUserIds).filter(Boolean);
    if (currentResolved.length > 0) {
      const extraAccountRows = await db
        .select({ userId: schema.account.userId })
        .from(schema.account)
        .where(inArray(schema.account.userId, currentResolved))
        .limit(50);

      for (const acc of extraAccountRows) {
        if (acc.userId) allUserIds.add(acc.userId);
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
    invalidateResourceCache('vault', rawData.userId);
    const titleVal = rawData.title || rawData.name || 'Untitled Secret';
    const typeVal = rawData.type || rawData.itemType || 'login';
    const encryptedDataVal = rawData.encrypted_data || rawData.encryptedData || rawData.password || rawData.secret || '';
    const ivVal = rawData.iv || null;
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
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listVaultItemsTurso(userId: string) {
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
}

export async function deleteVaultItemTurso(id: string) {
  try {
    invalidateResourceCache('vault');
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

export async function upsertTotpSecretTurso(data: any) {
  try {
    const rawData = data || {};
    invalidateResourceCache('totp', rawData.userId);
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
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertTotpSecretTurso failed:', err);
    return { success: false, error: err.message };
  }
}

export async function listTotpSecretsTurso(userId: string) {
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
}

export async function deleteTotpSecretTurso(id: string) {
  try {
    invalidateResourceCache('totp');
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.id, id));
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

export async function listWorkspacesTurso(userId: string) {
  const cacheKey = `workspaces:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const ownedRows = await db
      .select()
      .from(schema.projects)
      .where(
        or(
          inArray(schema.projects.creatorId, allUserIds),
          inArray(schema.projects.ownerId, allUserIds)
        )
      );

    const projectObjMemberships = await db
      .select({ workspaceId: schema.projectObjects.workspaceId })
      .from(schema.projectObjects)
      .where(inArray(schema.projectObjects.userId, allUserIds));

    const wsMemberships = await db
      .select({ workspaceId: schema.workspaceMembers.workspaceId })
      .from(schema.workspaceMembers)
      .where(inArray(schema.workspaceMembers.userId, allUserIds));

    const collabMemberships = await db
      .select({ resourceId: schema.collaborators.resourceId })
      .from(schema.collaborators)
      .where(
        and(
          inArray(schema.collaborators.userId, allUserIds),
          eq(schema.collaborators.resourceType, 'project')
        )
      );

    const memberIds = Array.from(new Set([
      ...projectObjMemberships.map((r) => r.workspaceId),
      ...wsMemberships.map((r) => r.workspaceId),
      ...collabMemberships.map((r) => r.resourceId),
    ])).filter(Boolean);

    const sharedRows = memberIds.length
      ? await db.select().from(schema.projects).where(inArray(schema.projects.id, memberIds))
      : [];

    const combinedMap = new Map<string, any>();
    for (const r of [...ownedRows, ...sharedRows]) {
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
    invalidateResourceCache('notes', data.userId);
    const updatedAt = data.updatedAt || new Date().toISOString();
    const payload = { ...data, updatedAt };

    await db.insert(schema.notes).values(payload).onConflictDoUpdate({
      target: schema.notes.id,
      set: payload,
    });

    try {
      const { broadcastRealtimeEvent } = await import('@/lib/realtime/partykit');
      await broadcastRealtimeEvent({
        databaseId: 'turso',
        tableId: 'ideas',
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
    invalidateResourceCache('notes');
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
      .where(and(inArray(schema.notes.userId, allUserIds), eq(schema.notes.isTrashed, false)));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
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
    invalidateResourceCache('goals', data.userId);
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
      await broadcastRealtimeEvent({
        tableId: 'tasks',
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

export async function listGoalsTurso(userId: string) {
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
      .where(inArray(schema.goals.userId, allUserIds));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
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
    invalidateResourceCache('goals');
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
    invalidateResourceCache('forms', data.userId);
    await db.insert(schema.forms).values(data).onConflictDoUpdate({
      target: schema.forms.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listFormsTurso(userId: string) {
  const cacheKey = `forms:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.forms)
      .where(inArray(schema.forms.userId, allUserIds));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listFormsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

export async function upsertEventTurso(data: typeof schema.events.$inferInsert) {
  try {
    invalidateResourceCache('events', data.userId);
    await db.insert(schema.events).values(data).onConflictDoUpdate({
      target: schema.events.id,
      set: data,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listEventsTurso(userId: string) {
  const cacheKey = `events:${userId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const allUserIds = await resolveAllUserIds(userId);

    const rows = await db
      .select()
      .from(schema.events)
      .where(inArray(schema.events.userId, allUserIds));
    const result = { success: true, rows };
    resourceCache.set(cacheKey, { data: result, expiresAt: Date.now() + queryTTLMs });
    return result;
  } catch (err: any) {
    console.error('[turso-ops] listEventsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

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
