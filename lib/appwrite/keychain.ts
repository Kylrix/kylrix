import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from './config';

const DB_ID = APPWRITE_CONFIG.DATABASES.VAULT;
const KEYCHAIN_TABLE = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

export const KeychainService = {
    async listKeychainEntries(userId: string) {
        try {
            const response = await tablesDB.listRows<any>({
                databaseId: DB_ID,
                tableId: KEYCHAIN_TABLE,
                queries: [Query.equal('userId', userId)]
            });
            return response.rows;
        } catch (error: unknown) {
            console.error('Failed to list keychain entries:', error);
            return [];
        }
    },

    async hasMasterpass(userId: string) {
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

        return await tablesDB.createRow(
            DB_ID,
            KEYCHAIN_TABLE,
            ID.unique(),
            data
        );
    },

    async deleteKeychainEntry(id: string) {
        return await tablesDB.deleteRow(
            DB_ID,
            KEYCHAIN_TABLE,
            id
        );
    }
};
