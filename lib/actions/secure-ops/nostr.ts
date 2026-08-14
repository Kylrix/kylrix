'use server';

import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getActor } from '../secure-ops/shared';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { ID, Permission, Query, Role } from 'node-appwrite';

export interface NostrIdentityRow {
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

const NOSTR_DB_ID = APPWRITE_CONFIG.DATABASE_ID;
const NOSTR_TABLE_ID = APPWRITE_CONFIG.TABLES.NOSTR_IDENTITIES;

/**
 * Retrieves all Nostr identity rows for the logged-in user.
 */
export async function listNostrIdentitiesAction(params?: { jwt?: string }): Promise<NostrIdentityRow[]> {
  try {
    const jwt = params?.jwt;
    const actor = await getActor(jwt);
    if (!actor) {
      return [];
    }
    const userId = actor.$id;

    const tables = createSystemTablesDB();
    const res = await tables.listRows<any>({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      queries: [Query.equal('userId', userId), Query.limit(50), Query.orderDesc('$createdAt')]
    });

    const rows = res.rows || [];
    if (rows.length === 0) return [];

    // Check if any row has an explicit isDefault: true
    const hasExplicitDefault = rows.some((r: any) => r.isDefault === true);

    return rows.map((row: any, idx: number) => {
      // If there's an explicit true, respect it; otherwise, the first/oldest row (or derived row) defaults to true
      const isDefault = hasExplicitDefault
        ? Boolean(row.isDefault)
        : (row.isDefault !== false && (row.isDerived || idx === rows.length - 1 || idx === 0));

      return {
        id: row.$id,
        npub: row.npub,
        label: row.label || '',
        isDefault: Boolean(isDefault),
        isDerived: Boolean(row.isDerived),
        encryptedNsec: row.encryptedNsec,
        iv: row.iv,
        salt: row.salt,
        createdAt: row.$createdAt
      };
    });
  } catch (err: any) {
    console.error('[NostrOps] Failed to list Nostr identity rows:', err);
    return [];
  }
}

/**
 * Retrieves the active/default encrypted Nostr identity row for the logged-in user.
 */
export async function getNostrIdentityAction(params?: { jwt?: string }): Promise<NostrIdentityRow | null> {
  try {
    const identities = await listNostrIdentitiesAction(params);
    if (!identities || identities.length === 0) {
      return null;
    }
    const active = identities.find(i => i.isDefault) || identities[0];
    return active;
  } catch (err: any) {
    console.error('[NostrOps] Failed to get Nostr identity row:', err);
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

    const tables = createSystemTablesDB();
    
    // Check if exact same npub already registered for this user
    const existing = await tables.listRows<any>({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      queries: [Query.equal('userId', userId), Query.equal('npub', params.npub), Query.limit(1)]
    });

    const makeDefault = params.makeDefault ?? true;

    if (makeDefault) {
      // Unset previous defaults for this user
      const allRows = await tables.listRows<any>({
        databaseId: NOSTR_DB_ID,
        tableId: NOSTR_TABLE_ID,
        queries: [Query.equal('userId', userId), Query.limit(50)]
      });
      for (const row of allRows.rows) {
        if (row.isDefault) {
          await tables.updateRow({
            databaseId: NOSTR_DB_ID,
            tableId: NOSTR_TABLE_ID,
            rowId: row.$id,
            data: { isDefault: false }
          }).catch(() => {});
        }
      }
    }

    if (existing.total > 0) {
      const targetRow = existing.rows[0];
      const updated = await tables.updateRow({
        databaseId: NOSTR_DB_ID,
        tableId: NOSTR_TABLE_ID,
        rowId: targetRow.$id,
        data: {
          encryptedNsec: params.encryptedNsec,
          iv: params.iv,
          salt: params.salt,
          label: params.label !== undefined ? params.label : (targetRow.label || ''),
          isDerived: params.isDerived !== undefined ? params.isDerived : Boolean(targetRow.isDerived),
          isDefault: makeDefault
        }
      });
      return { success: true, id: updated.$id, npub: updated.npub };
    }

    const row = await tables.createRow({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      rowId: ID.unique(),
      data: {
        userId,
        npub: params.npub,
        encryptedNsec: params.encryptedNsec,
        iv: params.iv,
        salt: params.salt,
        label: params.label || '',
        isDerived: Boolean(params.isDerived),
        isDefault: makeDefault
      },
      permissions: [
        Permission.read(Role.user(userId))
      ]
    });

    return {
      success: true,
      id: row.$id,
      npub: row.npub
    };
  } catch (err: any) {
    console.error('[NostrOps] Failed to register Nostr identity row:', err);
    throw new Error(err.message || 'Failed to register Nostr identity');
  }
}

/**
 * Sets an existing identity row as the default active identity.
 */
export async function setActiveNostrIdentityAction(params: { identityId: string; jwt?: string }) {
  try {
    const jwt = params.jwt;
    const actor = await getActor(jwt);
    if (!actor) throw new Error('Unauthorized');
    const userId = actor.$id;

    const tables = createSystemTablesDB();
    const allRows = await tables.listRows<any>({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      queries: [Query.equal('userId', userId), Query.limit(50)]
    });

    for (const row of allRows.rows) {
      const shouldBeDefault = row.$id === params.identityId;
      if (Boolean(row.isDefault) !== shouldBeDefault) {
        await tables.updateRow({
          databaseId: NOSTR_DB_ID,
          tableId: NOSTR_TABLE_ID,
          rowId: row.$id,
          data: { isDefault: shouldBeDefault }
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[NostrOps] Failed to set active Nostr identity row:', err);
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

    const tables = createSystemTablesDB();
    const target = await tables.getRow<any>({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      rowId: params.identityId
    });

    if (target.userId !== userId) throw new Error('Unauthorized');

    await tables.deleteRow({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      rowId: params.identityId
    });

    // If deleted row was default, elect another remaining row as default
    if (target.isDefault) {
      const remaining = await tables.listRows<any>({
        databaseId: NOSTR_DB_ID,
        tableId: NOSTR_TABLE_ID,
        queries: [Query.equal('userId', userId), Query.limit(1), Query.orderDesc('$createdAt')]
      });
      if (remaining.total > 0) {
        await tables.updateRow({
          databaseId: NOSTR_DB_ID,
          tableId: NOSTR_TABLE_ID,
          rowId: remaining.rows[0].$id,
          data: { isDefault: true }
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[NostrOps] Failed to delete Nostr identity row:', err);
    throw new Error(err.message || 'Failed to delete Nostr identity');
  }
}

/**
 * Resolves a list of Nostr npub identifiers to Kylrix profiles (userId, username, avatar).
 */
export async function resolveNostrPubkeysAction(npubs: string[]) {
  try {
    if (!npubs || npubs.length === 0) return {};

    const tables = createSystemTablesDB();

    // 1. Fetch matching identity rows
    const res = await tables.listRows<any>({
      databaseId: NOSTR_DB_ID,
      tableId: NOSTR_TABLE_ID,
      queries: [Query.equal('npub', npubs), Query.limit(100)]
    });

    if (res.total === 0) return {};

    // 2. Fetch corresponding profiles
    const userIds = res.rows.map((row: any) => row.userId);
    const profilesRes = await tables.listRows<any>({
      databaseId: NOSTR_DB_ID,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT.PROFILES,
      queries: [Query.equal('userId', userIds), Query.limit(100)]
    });

    const profileMap: Record<string, { userId: string; username: string; avatarUrl?: string }> = {};
    for (const row of profilesRes.rows) {
      profileMap[row.userId] = {
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl || row.avatar
      };
    }

    // 3. Map npub to profile
    const result: Record<string, { userId: string; username: string; avatarUrl?: string }> = {};
    for (const row of res.rows) {
      if (profileMap[row.userId]) {
        result[row.npub] = profileMap[row.userId];
      }
    }

    return result;
  } catch (err: any) {
    console.error('[NostrOps] Failed to resolve Nostr pubkeys:', err);
    return {};
  }
}
