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

    const { client } = await createServerClient(params?.jwt);
    const databases = new Databases(client);

    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      [Query.equal('userId', actor.$id), Query.limit(50), Query.orderDesc('$createdAt')]
    );

    return (res.documents || []).map((doc: any) => ({
      id: doc.$id,
      provider: doc.provider,
      keyHint: doc.keyHint || '',
      enabled: doc.enabled !== false,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt
    }));
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

    const { client } = await createServerClient(params.jwt);
    const databases = new Databases(client);

    // Check existing for this user + provider
    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      [Query.equal('userId', actor.$id), Query.equal('provider', provider), Query.limit(1)]
    );

    if (existing.total > 0) {
      const doc = existing.documents[0];
      const updated = await databases.updateDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
        doc.$id,
        {
          encryptedKey,
          keyHint,
          enabled: true
        }
      );
      return { success: true, id: updated.$id, keyHint };
    }

    const created = await databases.createDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      'unique()',
      {
        userId: actor.$id,
        provider,
        keyHint,
        encryptedKey,
        enabled: true
      }
    );

    return { success: true, id: created.$id, keyHint };
  } catch (err: any) {
    console.error('Failed to save agent BYOK key:', err);
    throw new Error(err.message || 'Failed to save BYOK key');
  }
}

/**
 * Removes an agent BYOK key.
 */
export async function deleteAgentByokKeyAction(params: {
  keyId: string;
  jwt?: string;
}) {
  try {
    const actor = await getActor(params.jwt);
    if (!actor) throw new Error('Unauthorized');

    const { client } = await createServerClient(params.jwt);
    const databases = new Databases(client);

    const target = await databases.getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      params.keyId
    );

    if (target.userId !== actor.$id) throw new Error('Unauthorized');

    await databases.deleteDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      params.keyId
    );

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete agent BYOK key:', err);
    throw new Error(err.message || 'Failed to delete BYOK key');
  }
}

/**
 * Internal resolver to fetch decrypted BYOK key for an unmanned background agent execution.
 */
export async function getDecryptedAgentByokKey(userId: string, provider: string): Promise<string | null> {
  try {
    const { client } = await createServerClient();
    const databases = new Databases(client);

    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.AGENT_BYOK_KEYS,
      [
        Query.equal('userId', userId),
        Query.equal('provider', provider.toLowerCase()),
        Query.equal('enabled', true),
        Query.limit(1)
      ]
    );

    if (res.total === 0) return null;
    const doc = res.documents[0];
    return decryptWithKylrixMek(doc.encryptedKey);
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
