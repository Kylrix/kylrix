'use server';

import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getActor } from '../secure-ops/shared';
import { Databases, Query } from 'node-appwrite';
import { encryptWithKylrixMek, decryptWithKylrixMek } from '@/lib/crypto/kylrix-mek';

export interface AgentByokKeySummary {
  id: string;
  provider: string;
  keyHint: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lists all registered BYOK API keys for the calling user (secrets stay redacted/masked).
 */
export async function listAgentByokKeysAction(params?: { jwt?: string }): Promise<AgentByokKeySummary[]> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return [];

    // 1. Check Turso first
    try {
      const { db } = await import('@/lib/db');
      const schema = await import('@/lib/db/schema');
      const { eq, desc } = await import('drizzle-orm');
      const rows = await db
        .select()
        .from(schema.agentByokKeys)
        .where(eq(schema.agentByokKeys.userId, actor.$id))
        .orderBy(desc(schema.agentByokKeys.createdAt));

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          keyHint: r.keyHint || r.keyHash || '••••',
          enabled: r.status === 'active',
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      }
    } catch {}

    // 2. Fallback to Appwrite
    const { client } = await createServerClient(params?.jwt);
    const databases = new Databases(client);

    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      [Query.equal('userId', actor.$id), Query.limit(50), Query.orderDesc('$createdAt')]
    );

    const items = (res.documents || []).map((doc: any) => ({
      id: doc.$id,
      provider: doc.provider,
      keyHint: doc.keyHint || '',
      enabled: doc.enabled !== false,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt
    }));

    // Non-blocking background seeding into Turso
    void (async () => {
      try {
        const { db } = await import('@/lib/db');
        const schema = await import('@/lib/db/schema');
        for (const doc of res.documents || []) {
          await db.insert(schema.agentByokKeys).values({
            id: doc.$id,
            userId: actor.$id,
            provider: doc.provider,
            keyHint: doc.keyHint || '••••',
            encryptedKey: doc.encryptedKey,
            status: doc.enabled !== false ? 'active' : 'inactive',
            createdAt: doc.$createdAt,
            updatedAt: doc.$updatedAt || doc.$createdAt,
          }).onConflictDoNothing().catch(() => {});
        }
      } catch {}
    })();

    return items;
  } catch (err: any) {
    console.error('Failed to list agent BYOK keys:', err);
    return [];
  }
}

/**
 * Saves (creates or updates) an agent BYOK key encrypted via server KYLRIX_MEK.
 */
export async function saveAgentByokKeyAction(params: {
  provider: string;
  apiKey: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const cleanKey = params.apiKey.trim();
    if (!cleanKey) throw new Error('API Key cannot be empty');

    const provider = params.provider.trim().toLowerCase();
    if (!provider) throw new Error('Provider cannot be empty');

    const keyHint = cleanKey.length > 8 ? `${cleanKey.slice(0, 4)}…${cleanKey.slice(-4)}` : '••••';
    const encryptedKey = encryptWithKylrixMek(cleanKey);
    const nowIso = new Date().toISOString();
    const rowId = `byok_${actor.$id}_${provider}`;

    // 1. Insert/Update in Turso SQLite
    try {
      const { db } = await import('@/lib/db');
      const schema = await import('@/lib/db/schema');
      const { eq, and } = await import('drizzle-orm');

      const existing = await db
        .select()
        .from(schema.agentByokKeys)
        .where(
          and(
            eq(schema.agentByokKeys.userId, actor.$id),
            eq(schema.agentByokKeys.provider, provider)
          )
        )
        .limit(1);

      if (existing && existing.length > 0) {
        await db
          .update(schema.agentByokKeys)
          .set({
            encryptedKey,
            keyHint,
            keyHash: keyHint,
            status: 'active',
            updatedAt: nowIso,
          })
          .where(eq(schema.agentByokKeys.id, existing[0].id));
      } else {
        await db.insert(schema.agentByokKeys).values({
          id: rowId,
          userId: actor.$id,
          provider,
          keyHint,
          keyHash: keyHint,
          encryptedKey,
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } catch (tursoErr) {
      console.warn('[saveAgentByokKeyAction] Turso write warning:', tursoErr);
    }

    // 2. Non-blocking Appwrite sync
    void (async () => {
      try {
        const { client } = await createServerClient(params.jwt);
        const databases = new Databases(client);

        const existing = await databases.listDocuments(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
          [Query.equal('userId', actor.$id), Query.equal('provider', provider), Query.limit(1)]
        );

        if (existing.total > 0) {
          await databases.updateDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
            existing.documents[0].$id,
            {
              encryptedKey,
              keyHint,
              enabled: true
            }
          );
        } else {
          await databases.createDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
            rowId,
            {
              userId: actor.$id,
              provider,
              keyHint,
              encryptedKey,
              enabled: true
            }
          );
        }
      } catch {}
    })();

    return { success: true, id: rowId, keyHint };
  } catch (err: any) {
    console.error('Failed to save agent BYOK key:', err);
    throw new Error(err.message || 'Failed to save BYOK key');
  }
}

/**
 * Removes an agent BYOK key.
 */
export async function deleteAgentByokKeyAction(params: {
  keyId?: string;
  provider?: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const provider = params.provider ? params.provider.trim().toLowerCase() : undefined;

    // 1. Delete from Turso SQLite
    try {
      const { db } = await import('@/lib/db');
      const schema = await import('@/lib/db/schema');
      const { eq, and } = await import('drizzle-orm');

      if (params.keyId) {
        await db
          .delete(schema.agentByokKeys)
          .where(
            and(
              eq(schema.agentByokKeys.userId, actor.$id),
              eq(schema.agentByokKeys.id, params.keyId)
            )
          );
      } else if (provider) {
        await db
          .delete(schema.agentByokKeys)
          .where(
            and(
              eq(schema.agentByokKeys.userId, actor.$id),
              eq(schema.agentByokKeys.provider, provider)
            )
          );
      }
    } catch (tursoErr) {
      console.warn('[deleteAgentByokKeyAction] Turso delete warning:', tursoErr);
    }

    // 2. Non-blocking Appwrite sync
    void (async () => {
      try {
        const { client } = await createServerClient(params.jwt);
        const databases = new Databases(client);

        if (params.keyId) {
          await databases.deleteDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
            params.keyId
          ).catch(() => {});
        } else if (provider) {
          const res = await databases.listDocuments(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
            [Query.equal('userId', actor.$id), Query.equal('provider', provider), Query.limit(5)]
          );
          for (const doc of res.documents || []) {
            await databases.deleteDocument(
              APPWRITE_CONFIG.DATABASE_ID,
              APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
              doc.$id
            ).catch(() => {});
          }
        }
      } catch {}
    })();

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete agent BYOK key:', err);
    throw new Error(err.message || 'Failed to delete BYOK key');
  }
}

/**
 * Checks whether the user has a configured BYOK key.
 */
export async function hasAgentByokKeyAction(params?: { provider?: string; jwt?: string }): Promise<boolean> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return false;

    const provider = (params?.provider || 'gemini').trim().toLowerCase();
    const providerAliases = provider === 'gemini' || provider === 'google' ? ['gemini', 'google'] : [provider];

    // Check Turso first
    try {
      const { db } = await import('@/lib/db');
      const schema = await import('@/lib/db/schema');
      const { eq, and, inArray } = await import('drizzle-orm');

      const rows = await db
        .select({ id: schema.agentByokKeys.id })
        .from(schema.agentByokKeys)
        .where(
          and(
            eq(schema.agentByokKeys.userId, actor.$id),
            inArray(schema.agentByokKeys.provider, providerAliases),
            eq(schema.agentByokKeys.status, 'active')
          )
        )
        .limit(1);

      if (rows && rows.length > 0) return true;
    } catch {}

    const keys = await listAgentByokKeysAction({ jwt: params?.jwt });
    return keys.some(k => providerAliases.includes(k.provider.toLowerCase()) && k.enabled);
  } catch {
    return false;
  }
}

/**
 * Internal resolver to fetch decrypted BYOK key for an unmanned background agent execution.
 */
export async function getDecryptedAgentByokKey(userId: string, provider: string): Promise<string | null> {
  const normProvider = provider.trim().toLowerCase();
  const providerAliases = normProvider === 'gemini' || normProvider === 'google' ? ['gemini', 'google'] : [normProvider];

  // 1. Check Turso first
  try {
    const { db } = await import('@/lib/db');
    const schema = await import('@/lib/db/schema');
    const { eq, and, inArray } = await import('drizzle-orm');

    const rows = await db
      .select({ encryptedKey: schema.agentByokKeys.encryptedKey })
      .from(schema.agentByokKeys)
      .where(
        and(
          eq(schema.agentByokKeys.userId, userId),
          inArray(schema.agentByokKeys.provider, providerAliases),
          eq(schema.agentByokKeys.status, 'active')
        )
      )
      .limit(1);

    if (rows && rows.length > 0 && rows[0].encryptedKey) {
      return decryptWithKylrixMek(rows[0].encryptedKey);
    }
  } catch (err) {
    console.warn('[getDecryptedAgentByokKey] Turso query warning:', err);
  }

  // 2. Fallback to Appwrite with timeout race
  try {
    const { client } = await createServerClient();
    const databases = new Databases(client);

    const appwritePromise = databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      [
        Query.equal('userId', userId),
        Query.equal('enabled', true),
        Query.limit(10)
      ]
    );
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const res: any = await Promise.race([appwritePromise, timeoutPromise]);

    if (res && res.documents && res.documents.length > 0) {
      const match = res.documents.find((d: any) => providerAliases.includes(String(d.provider || '').toLowerCase()));
      if (match?.encryptedKey) {
        return decryptWithKylrixMek(match.encryptedKey);
      }
    }
    return null;
  } catch (err) {
    console.error('Failed to resolve decrypted agent BYOK key:', err);
    return null;
  }
}

/* =========================================================================================
 * CONVENIENCE MODE (Remember Unlock with KYLRIX_MEK Envelope)
 * ========================================================================================= */

/**
 * Sets convenience mode for the user by encrypting their MEK with KYLRIX_MEK.
 * @param durationSeconds Optional duration (e.g. 7 days). If null/undefined, indefinite.
 */
export async function enableConvenienceModeAction(params: {
  rawUserMekBase64: string;
  durationSeconds?: number | null;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const encryptedUserMek = encryptWithKylrixMek(params.rawUserMekBase64);
    let expiresAt: string | null = null;
    if (params.durationSeconds && params.durationSeconds > 0) {
      expiresAt = new Date(Date.now() + params.durationSeconds * 1000).toISOString();
    }

    const { client } = await createServerClient(params.jwt);
    const databases = new Databases(client);

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
      [Query.equal('userId', actor.$id), Query.limit(1)]
    );

    if (existing.total > 0) {
      await databases.updateDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
        existing.documents[0].$id,
        {
          encryptedUserMek,
          expiresAt
        }
      );
    } else {
      await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
        'unique()',
        {
          userId: actor.$id,
          encryptedUserMek,
          expiresAt
        }
      );
    }

    return { success: true, expiresAt };
  } catch (err: any) {
    console.error('Failed to enable convenience mode:', err);
    throw new Error(err.message || 'Failed to enable convenience mode');
  }
}

/**
 * Disables convenience mode and purges the row.
 */
export async function disableConvenienceModeAction(params?: { jwt?: string }) {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) throw new Error('Unauthorized');

    const { client } = await createServerClient(params?.jwt);
    const databases = new Databases(client);

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
      [Query.equal('userId', actor.$id), Query.limit(1)]
    );

    if (existing.total > 0) {
      await databases.deleteDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
        existing.documents[0].$id
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to disable convenience mode:', err);
    throw new Error(err.message || 'Failed to disable convenience mode');
  }
}

/**
 * Checks convenience mode status and retrieves decrypted MEK if active and unexpired.
 * If expired, automatically cleans up the row.
 */
export async function resolveConvenienceMekAction(params?: { jwt?: string }): Promise<{
  active: boolean;
  rawUserMekBase64?: string;
  expiresAt?: string | null;
}> {
  try {
    const actor = await getActor(params?.jwt);
    if (!actor) return { active: false };

    const { client } = await createServerClient(params?.jwt);
    const databases = new Databases(client);

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
      [Query.equal('userId', actor.$id), Query.limit(1)]
    );

    if (existing.total === 0) return { active: false };

    const doc = existing.documents[0];
    if (doc.expiresAt) {
      const exp = new Date(doc.expiresAt).getTime();
      if (Date.now() > exp) {
        // Expired — purge row
        await databases.deleteDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TABLES.USER_CONVENIENCE_SESSIONS,
          doc.$id
        ).catch(() => {});
        return { active: false };
      }
    }

    const rawUserMekBase64 = decryptWithKylrixMek(doc.encryptedUserMek);
    return {
      active: true,
      rawUserMekBase64,
      expiresAt: doc.expiresAt || null
    };
  } catch (err: any) {
    console.error('Failed to resolve convenience MEK:', err);
    return { active: false };
  }
}
