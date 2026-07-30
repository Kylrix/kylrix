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

    const { value, source } = await raceNetworkOrLocal({
      timeoutMs: 2500,
      network: async () => {
        const response = await tablesDB.listRows<any>({
          databaseId: DB_ID,
          tableId: KEYCHAIN_TABLE,
          queries: [Query.equal('userId', userId)]});
        return response.rows || [];
      },
      local: async () => local,
    });

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

    const created = await tablesDB.createRow(DB_ID, KEYCHAIN_TABLE, ID.unique(), data);
    if (data.userId) {
      const existing = await SecurityEnclave.getKeychain(data.userId);
      await SecurityEnclave.setKeychain(data.userId, [created, ...existing.filter((e) => e.$id !== created.$id)]);
      await SecurityEnclave.markDirty(data.userId);
    }
    return created;
  },

  async deleteKeychainEntry(id: string) {
    return tablesDB.deleteRow(DB_ID, KEYCHAIN_TABLE, id);
  },
};
