'use server';

import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getActor } from '../secure-ops/shared';
import { Databases, Query } from 'node-appwrite';

/**
 * Retrieves all Nostr identities for the logged-in user.
 */
export async function listNostrIdentitiesAction(params?: { jwt?: string }) {
  try {
    const jwt = params?.jwt;
    const actor = await getActor(jwt);
    if (!actor) {
      return [];
    }
    const userId = actor.$id;

    const { client } = await createServerClient(jwt);
    const databases = new Databases(client);
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(25), Query.orderDesc('$createdAt')]
    );

    return (res.documents || []).map((row: any) => ({
      id: row.$id,
      npub: row.npub,
      label: row.label || '',
      isDefault: Boolean(row.isDefault),
      isDerived: Boolean(row.isDerived),
      encryptedNsec: row.encryptedNsec,
      iv: row.iv,
      salt: row.salt,
      createdAt: row.$createdAt
    }));
  } catch (err: any) {
    console.error('Failed to list Nostr identities:', err);
    return [];
  }
}

/**
 * Retrieves the active/default encrypted Nostr identity for the logged-in user.
 */
export async function getNostrIdentityAction(params?: { jwt?: string }) {
  try {
    const identities = await listNostrIdentitiesAction(params);
    if (!identities || identities.length === 0) {
      return null;
    }
    const active = identities.find(i => i.isDefault) || identities[0];
    return active;
  } catch (err: any) {
    console.error('Failed to get Nostr identity row:', err);
    throw new Error(err.message || 'Failed to fetch Nostr identity');
  }
}

/**
 * Registers or adds a Nostr identity row for the logged-in user.
 */
export async function registerNostrIdentityAction(params: {
  npub: string;
  encryptedNsec: string;
  iv: string;
  salt: string;
  label?: string;
  isDerived?: boolean;
  makeDefault?: boolean;
  jwt?: string;
}) {
  try {
    const jwt = params.jwt;
    const actor = await getActor(jwt);
    if (!actor) {
      throw new Error('Unauthorized: You must be logged in to register a Nostr identity');
    }
    const userId = actor.$id;

    const { client } = await createServerClient(jwt);
    const databases = new Databases(client);
    
    // Check if exact same npub already registered for user
    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.equal('npub', params.npub), Query.limit(1)]
    );

    const makeDefault = params.makeDefault ?? true;

    if (makeDefault) {
      // Unset previous defaults
      const allRows = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
        [Query.equal('userId', userId), Query.limit(50)]
      );
      for (const doc of allRows.documents) {
        if (doc.isDefault) {
          await databases.updateDocument(
            APPWRITE_CONFIG.DATABASE_ID,
            APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
            doc.$id,
            { isDefault: false }
          ).catch(() => {});
        }
      }
    }

    if (existing.total > 0) {
      const doc = existing.documents[0];
      const updated = await databases.updateDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
        doc.$id,
        {
          encryptedNsec: params.encryptedNsec,
          iv: params.iv,
          salt: params.salt,
          label: params.label !== undefined ? params.label : (doc.label || ''),
          isDerived: params.isDerived !== undefined ? params.isDerived : Boolean(doc.isDerived),
          isDefault: makeDefault
        }
      );
      return { success: true, id: updated.$id, npub: updated.npub };
    }

    const row = await databases.createDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      'unique()',
      {
        userId,
        npub: params.npub,
        encryptedNsec: params.encryptedNsec,
        iv: params.iv,
        salt: params.salt,
        label: params.label || '',
        isDerived: Boolean(params.isDerived),
        isDefault: makeDefault
      }
    );

    return {
      success: true,
      id: row.$id,
      npub: row.npub
    };
  } catch (err: any) {
    console.error('Failed to register Nostr identity row:', err);
    throw new Error(err.message || 'Failed to register Nostr identity');
  }
}

/**
 * Sets an existing identity as the default active identity.
 */
export async function setActiveNostrIdentityAction(params: { identityId: string; jwt?: string }) {
  try {
    const jwt = params.jwt;
    const actor = await getActor(jwt);
    if (!actor) throw new Error('Unauthorized');
    const userId = actor.$id;

    const { client } = await createServerClient(jwt);
    const databases = new Databases(client);

    const allRows = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(50)]
    );

    for (const doc of allRows.documents) {
      const shouldBeDefault = doc.$id === params.identityId;
      if (Boolean(doc.isDefault) !== shouldBeDefault) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
          doc.$id,
          { isDefault: shouldBeDefault }
        );
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to set active Nostr identity:', err);
    throw new Error(err.message || 'Failed to set active Nostr identity');
  }
}

/**
 * Deletes a custom Nostr identity row.
 */
export async function deleteNostrIdentityAction(params: { identityId: string; jwt?: string }) {
  try {
    const jwt = params.jwt;
    const actor = await getActor(jwt);
    if (!actor) throw new Error('Unauthorized');
    const userId = actor.$id;

    const { client } = await createServerClient(jwt);
    const databases = new Databases(client);

    const target = await databases.getDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      params.identityId
    );

    if (target.userId !== userId) throw new Error('Unauthorized');

    await databases.deleteDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      params.identityId
    );

    // If deleted row was default, elect another identity as default
    if (target.isDefault) {
      const remaining = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
        [Query.equal('userId', userId), Query.limit(1), Query.orderDesc('$createdAt')]
      );
      if (remaining.total > 0) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
          remaining.documents[0].$id,
          { isDefault: true }
        );
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete Nostr identity:', err);
    throw new Error(err.message || 'Failed to delete Nostr identity');
  }
}

/**
 * Resolves a list of Nostr npub identifiers to Kylrix profiles (userId, username, avatar).
 */
export async function resolveNostrPubkeysAction(npubs: string[]) {
  try {
    const { client } = await createServerClient();
    const databases = new Databases(client);

    if (!npubs || npubs.length === 0) return {};

    // 1. Fetch matching identity rows
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('npub', npubs), Query.limit(100)]
    );

    if (res.total === 0) return {};

    // 2. Fetch corresponding profiles
    const userIds = res.documents.map((doc: any) => doc.userId);
    const profilesRes = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.CONNECT.PROFILES,
      [Query.equal('userId', userIds), Query.limit(100)]
    );

    const profileMap: Record<string, { userId: string; username: string; avatarUrl?: string }> = {};
    for (const doc of profilesRes.documents) {
      profileMap[doc.userId] = {
        userId: doc.userId,
        username: doc.username,
        avatarUrl: doc.avatarUrl || doc.avatar
      };
    }

    // 3. Map npub to profile
    const result: Record<string, { userId: string; username: string; avatarUrl?: string }> = {};
    for (const doc of res.documents) {
      if (profileMap[doc.userId]) {
        result[doc.npub] = profileMap[doc.userId];
      }
    }

    return result;
  } catch (err: any) {
    console.error('Failed to resolve Nostr pubkeys:', err);
    return {};
  }
}
