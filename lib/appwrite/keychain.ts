import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from './config';
import { SecurityEnclave, raceNetworkOrLocal } from '@/lib/security/enclave';

const DB_ID = APPWRITE_CONFIG.DATABASES.VAULT;
const KEYCHAIN_TABLE = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

export const KeychainService = {
  async listKeychainEntries(userId: string) {
    const local = await SecurityEnclave.getKeychain(userId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return local;
    }

    // 1. Primary: query Turso keychain
    try {
      const { listKeychainTurso } = await import('@/lib/actions/turso-ops');
      const res = await listKeychainTurso(userId);
      if (res.success && Array.isArray(res.rows) && res.rows.length > 0) {
        const mapped = res.rows.map((r: any) => ({
          ...r,
          $id: r.id,
          wrappedKey: r.encryptedPayload,
          salt: r.nonce,
        }));
        await SecurityEnclave.setKeychain(userId, mapped);
        return mapped;
      }
    } catch (tursoErr) {
      console.warn('[KeychainService] Turso list failed, attempting secondary Appwrite fallback:', tursoErr);
    }

    // 2. Secondary: fallback to legacy Appwrite and trigger aggressive Tier 1 sync
    const { value, source } = await raceNetworkOrLocal({
      timeoutMs: 2500,
      network: async () => {
        const response = await tablesDB.listRows<any>({
          databaseId: DB_ID,
          tableId: KEYCHAIN_TABLE,
          queries: [Query.equal('userId', userId)]});
        const rows = response.rows || [];
        if (rows.length > 0) {
          // Trigger silent aggressive Tier 1 sync into Turso
          void import('@/lib/actions/turso-ops').then(({ syncTier1FromAppwriteTurso }) => {
            syncTier1FromAppwriteTurso(userId, true);
          }).catch(() => {});
        }
        return rows;
      },
      local: async () => local});

    if (source === 'network' && Array.isArray(value) && value.length > 0) {
      await SecurityEnclave.setKeychain(userId, value);
      return value;
    }

    if (local.length > 0) return local;
    return Array.isArray(value) ? value : [];
  },

  async hasMasterpass(userId: string) {
    const probe = await SecurityEnclave.probeCapabilities(userId);
    if (probe.hasMasterpass) return true;
    const entries = await this.listKeychainEntries(userId);
    return entries.some((e: any) => e.type === 'password');
  },

  async createKeychainEntry(data: any) {
    if (data.type === 'password' && data.userId) {
      const existing = await this.listKeychainEntries(data.userId);
      const hasPassword = existing.some((e: any) => e.type === 'password');

      if (hasPassword) {
        console.warn('[KeychainService] Blocked attempt to create duplicate master password.');
        throw new Error('KEYCHAIN_ALREADY_EXISTS');
      }
    }

    const rowId = data.$id || ID.unique();
    const now = new Date().toISOString();

    // 1. Primary write to Turso
    try {
      const { upsertKeychainTurso } = await import('@/lib/actions/turso-ops');
      await upsertKeychainTurso({
        id: rowId,
        userId: data.userId,
        account: data.account || 'masterpass',
        type: data.type || 'password',
        encryptedPayload: data.encryptedPayload || data.wrappedKey || '',
        nonce: data.nonce || data.salt || null,
        metadata: data.metadata || (data.params ? JSON.stringify({ params: data.params, isArgon: data.isArgon }) : null),
        createdAt: data.createdAt || now,
        updatedAt: now,
      });
    } catch (tursoErr) {
      console.warn('[KeychainService] Turso upsertKeychainTurso warning:', tursoErr);
    }

    // 2. Secondary write to Appwrite (if Appwrite session is available)
    let created: any = { ...data, $id: rowId };
    try {
      created = await tablesDB.createRow(DB_ID, KEYCHAIN_TABLE, rowId, data);
    } catch (appwriteErr: any) {
      console.warn('[KeychainService] Appwrite secondary write bypassed (primary Turso active):', appwriteErr?.message);
    }

    if (data.userId) {
      const existing = await SecurityEnclave.getKeychain(data.userId);
      await SecurityEnclave.setKeychain(data.userId, [created, ...existing.filter((e) => e.$id !== created.$id)]);
      await SecurityEnclave.markDirty(data.userId);
    }
    return created;
  },

  async deleteKeychainEntry(id: string) {
    try {
      const { deleteKeychainTurso } = await import('@/lib/actions/turso-ops');
      await deleteKeychainTurso(id);
    } catch {}

    try {
      await tablesDB.deleteRow(DB_ID, KEYCHAIN_TABLE, id);
    } catch {}
    return { success: true };
  }};
