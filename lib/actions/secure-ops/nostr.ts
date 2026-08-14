'use server';

import { createServerClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getActor } from '../secure-ops/shared';
import { Databases, Query } from 'node-appwrite';

interface StoredIdentityItem {
  id: string;
  npub: string;
  label: string;
  isDefault: boolean;
  isDerived: boolean;
  encryptedNsec: string;
  iv: string;
  salt: string;
  createdAt: string;
}

/**
 * Retrieves all Nostr identities for the logged-in user.
 */
export async function listNostrIdentitiesAction(params?: { jwt?: string }): Promise<StoredIdentityItem[]> {
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

    const rows = res.documents || [];
    if (rows.length === 0) return [];

    const identities: StoredIdentityItem[] = [];
    for (const row of rows) {
      // Check if this row stores bundled identities in label/encryptedNsec or individual identity
      let bundled: StoredIdentityItem[] | null = null;
      try {
        if (row.encryptedNsec && row.encryptedNsec.startsWith('bundle:')) {
          bundled = JSON.parse(row.encryptedNsec.slice(7));
        }
      } catch {}

      if (bundled && Array.isArray(bundled)) {
        identities.push(...bundled);
      } else {
        identities.push({
          id: row.$id,
          npub: row.npub,
          label: row.label || '',
          isDefault: Boolean(row.isDefault),
          isDerived: Boolean(row.isDerived),
          encryptedNsec: row.encryptedNsec,
          iv: row.iv,
          salt: row.salt,
          createdAt: row.$createdAt
        });
      }
    }

    return identities;
  } catch (err: any) {
    console.error('Failed to list Nostr identity rows:', err);
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
    
    // Check if user already has an existing row in nostr_identities table
    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(10)]
    );

    const makeDefault = params.makeDefault ?? true;

    // If no row exists, create the first row for this user
    if (existing.total === 0) {
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
          isDefault: true
        }
      );

      return {
        success: true,
        id: row.$id,
        npub: row.npub
      };
    }

    // If an existing row exists, check if user is updating the same npub
    const userRow = existing.documents[0];
    let allIdentities: StoredIdentityItem[] = [];

    let isBundled = false;
    try {
      if (userRow.encryptedNsec && userRow.encryptedNsec.startsWith('bundle:')) {
        allIdentities = JSON.parse(userRow.encryptedNsec.slice(7));
        isBundled = true;
      }
    } catch {}

    if (!isBundled) {
      allIdentities = [{
        id: userRow.$id,
        npub: userRow.npub,
        label: userRow.label || '',
        isDefault: Boolean(userRow.isDefault),
        isDerived: Boolean(userRow.isDerived),
        encryptedNsec: userRow.encryptedNsec,
        iv: userRow.iv,
        salt: userRow.salt,
        createdAt: userRow.$createdAt
      }];
    }

    // If making default, reset default flag on others
    if (makeDefault) {
      allIdentities = allIdentities.map(i => ({ ...i, isDefault: false }));
    }

    const existingIdx = allIdentities.findIndex(i => i.npub === params.npub);
    const newEntry: StoredIdentityItem = {
      id: existingIdx >= 0 ? allIdentities[existingIdx].id : `id_${Date.now()}`,
      npub: params.npub,
      label: params.label || (existingIdx >= 0 ? allIdentities[existingIdx].label : ''),
      isDefault: makeDefault,
      isDerived: params.isDerived !== undefined ? Boolean(params.isDerived) : (existingIdx >= 0 ? allIdentities[existingIdx].isDerived : false),
      encryptedNsec: params.encryptedNsec,
      iv: params.iv,
      salt: params.salt,
      createdAt: existingIdx >= 0 ? allIdentities[existingIdx].createdAt : new Date().toISOString()
    };

    if (existingIdx >= 0) {
      allIdentities[existingIdx] = newEntry;
    } else {
      allIdentities.push(newEntry);
    }

    // Determine primary identity for top-level columns
    const defaultIdentity = allIdentities.find(i => i.isDefault) || allIdentities[0];

    // Store bundled JSON in encryptedNsec with bundle: prefix if multiple identities exist
    const encryptedPayload = allIdentities.length > 1 
      ? `bundle:${JSON.stringify(allIdentities)}`
      : defaultIdentity.encryptedNsec;

    await databases.updateDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      userRow.$id,
      {
        npub: defaultIdentity.npub,
        encryptedNsec: encryptedPayload,
        iv: defaultIdentity.iv,
        salt: defaultIdentity.salt,
        label: defaultIdentity.label || '',
        isDerived: defaultIdentity.isDerived,
        isDefault: true
      }
    );

    return {
      success: true,
      id: newEntry.id,
      npub: newEntry.npub
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

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (existing.total === 0) return { success: true };

    const userRow = existing.documents[0];
    let allIdentities: StoredIdentityItem[] = [];

    try {
      if (userRow.encryptedNsec && userRow.encryptedNsec.startsWith('bundle:')) {
        allIdentities = JSON.parse(userRow.encryptedNsec.slice(7));
      } else {
        allIdentities = [{
          id: userRow.$id,
          npub: userRow.npub,
          label: userRow.label || '',
          isDefault: true,
          isDerived: Boolean(userRow.isDerived),
          encryptedNsec: userRow.encryptedNsec,
          iv: userRow.iv,
          salt: userRow.salt,
          createdAt: userRow.$createdAt
        }];
      }
    } catch {}

    allIdentities = allIdentities.map(i => ({
      ...i,
      isDefault: i.id === params.identityId || i.npub === params.identityId
    }));

    const defaultIdentity = allIdentities.find(i => i.isDefault) || allIdentities[0];
    const encryptedPayload = allIdentities.length > 1
      ? `bundle:${JSON.stringify(allIdentities)}`
      : defaultIdentity.encryptedNsec;

    await databases.updateDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      userRow.$id,
      {
        npub: defaultIdentity.npub,
        encryptedNsec: encryptedPayload,
        iv: defaultIdentity.iv,
        salt: defaultIdentity.salt,
        label: defaultIdentity.label || '',
        isDerived: defaultIdentity.isDerived,
        isDefault: true
      }
    );

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

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      [Query.equal('userId', userId), Query.limit(1)]
    );

    if (existing.total === 0) return { success: true };

    const userRow = existing.documents[0];
    let allIdentities: StoredIdentityItem[] = [];

    try {
      if (userRow.encryptedNsec && userRow.encryptedNsec.startsWith('bundle:')) {
        allIdentities = JSON.parse(userRow.encryptedNsec.slice(7));
      } else {
        allIdentities = [{
          id: userRow.$id,
          npub: userRow.npub,
          label: userRow.label || '',
          isDefault: true,
          isDerived: Boolean(userRow.isDerived),
          encryptedNsec: userRow.encryptedNsec,
          iv: userRow.iv,
          salt: userRow.salt,
          createdAt: userRow.$createdAt
        }];
      }
    } catch {}

    allIdentities = allIdentities.filter(i => i.id !== params.identityId && i.npub !== params.identityId);

    if (allIdentities.length === 0) {
      await databases.deleteDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
        userRow.$id
      );
      return { success: true };
    }

    if (!allIdentities.some(i => i.isDefault)) {
      allIdentities[0].isDefault = true;
    }

    const defaultIdentity = allIdentities.find(i => i.isDefault) || allIdentities[0];
    const encryptedPayload = allIdentities.length > 1
      ? `bundle:${JSON.stringify(allIdentities)}`
      : defaultIdentity.encryptedNsec;

    await databases.updateDocument(
      APPWRITE_CONFIG.DATABASE_ID,
      APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES,
      userRow.$id,
      {
        npub: defaultIdentity.npub,
        encryptedNsec: encryptedPayload,
        iv: defaultIdentity.iv,
        salt: defaultIdentity.salt,
        label: defaultIdentity.label || '',
        isDerived: defaultIdentity.isDerived,
        isDefault: true
      }
    );

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
