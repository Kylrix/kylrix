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
    const accountInfo = await account.get();
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
