'use client';

import { tablesDB } from '@/lib/appwrite/client';
import { ID, Query, Permission, Role } from 'appwrite';
import { encryptField, decryptField, masterPassCrypto } from '@/lib/masterpass-crypto';

const DATABASE_ID = 'whisperrflow';
const TABLE_ID = 'user_keys';

export const BYOKManager = {
  /**
   * Check if the user has unlocked their encryption vault.
   */
  isUnlocked(): boolean {
    return masterPassCrypto.isVaultUnlocked();
  },

  /**
   * Check if a key is configured in Appwrite for the user and provider.
   */
  async hasKey(userId: string, provider: string = 'gemini'): Promise<boolean> {
    try {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [
          Query.equal('userId', userId),
          Query.equal('provider', provider),
          Query.limit(1)
        ]
      });
      return res.documents.length > 0;
    } catch (err) {
      console.error('Failed to check BYOK presence:', err);
      return false;
    }
  },

  /**
   * Securely encrypt and save an API key under row-level security.
   */
  async saveKey(userId: string, provider: string, rawKey: string): Promise<void> {
    if (!this.isUnlocked()) {
      throw new Error('Please unlock your security vault to configure private keys.');
    }

    const encryptedVal = await encryptField(rawKey);

    // Check if key already exists
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [
        Query.equal('userId', userId),
        Query.equal('provider', provider),
        Query.limit(1)
      ]
    });

    const existingRow = res.rows[0];

    const payload = {
      userId,
      provider,
      encrypted_key: encryptedVal,
      iv: 'embedded', // Cryptographic IV is already safely embedded inside the ciphertext by encryptField
      config: JSON.stringify({ savedAt: new Date().toISOString() })
    };

    const permissions = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId))
    ];

    if (existingRow) {
      await tablesDB.updateRow(
        DATABASE_ID,
        TABLE_ID,
        existingRow.$id,
        payload,
        permissions
      );
    } else {
      await tablesDB.createRow(
        DATABASE_ID,
        TABLE_ID,
        ID.unique(),
        payload,
        permissions
      );
    }
  },

  /**
   * Retrieve and decrypt the API key on the client.
   */
  async retrieveKey(userId: string, provider: string = 'gemini'): Promise<string | null> {
    try {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [
          Query.equal('userId', userId),
          Query.equal('provider', provider),
          Query.limit(1)
        ]
      });

      const row = res.rows[0];
      if (!row || !row.encrypted_key) {
        return null;
      }

      if (!this.isUnlocked()) {
        throw new Error('Vault is locked. Unlock your security vault to decrypt your AI API key.');
      }

      const decrypted = await decryptField(row.encrypted_key);
      return decrypted;
    } catch (err) {
      console.error('Failed to retrieve or decrypt BYOK key:', err);
      return null;
    }
  },

  /**
   * Delete the configured key.
   */
  async deleteKey(userId: string, provider: string = 'gemini'): Promise<void> {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [
        Query.equal('userId', userId),
        Query.equal('provider', provider),
        Query.limit(1)
      ]
    });

    const row = res.rows[0];
    if (row) {
      await tablesDB.deleteRow(DATABASE_ID, TABLE_ID, row.$id);
    }
  }
};
