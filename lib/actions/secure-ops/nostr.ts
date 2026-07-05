'use server';

import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Databases, Query } from 'node-appwrite';

/**
 * Retrieves the encrypted Nostr identity for the logged-in user.
 * Conforms to the terminology mandate (Rows over Documents, Tables over Collections).
 */
export async function getNostrIdentityAction() {
  try {
    const { client, account } = await createServerClient();
    let accountInfo;
    try {
      accountInfo = await account.get();
    } catch {
      // Gracefully handle unauthenticated/guest users
      return null;
    }
    const userId = accountInfo.$id;

    const databases = new Databases(client);
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (res.total === 0) {
      return null;
    }

    const row = res.documents[0];
    return {
      npub: row.npub,
      encryptedNsec: row.encryptedNsec,
      iv: row.iv,
      salt: row.salt
    };
  } catch (err: any) {
    // If it's a guest account permission error, return null instead of throwing
    if (err.message && err.message.includes('missing scopes')) {
      return null;
    }
    console.error('Failed to get Nostr identity row:', err);
    throw new Error(err.message || 'Failed to fetch Nostr identity');
  }
}

/**
 * Registers a new Nostr identity row for the logged-in user.
 */
export async function registerNostrIdentityAction(params: {
  npub: string;
  encryptedNsec: string;
  iv: string;
  salt: string;
}) {
  try {
    const { client, account } = await createServerClient();
    const accountInfo = await account.get();
    const userId = accountInfo.$id;

    const databases = new Databases(client);
    
    // Ensure uniqueness constraint
    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (existing.total > 0) {
      throw new Error('Nostr identity row already registered for this user');
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
        salt: params.salt
      }
    );

    return {
      success: true,
      npub: row.npub
    };
  } catch (err: any) {
    console.error('Failed to register Nostr identity row:', err);
    throw new Error(err.message || 'Failed to register Nostr identity');
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
    const userIds = res.documents.map((doc) => doc.userId);
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
