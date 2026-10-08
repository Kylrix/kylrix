'use client';

import { tablesDB } from '@/lib/appwrite/client';
import { ID, Query, Permission, Role } from 'appwrite';
import { encryptField, decryptField, masterPassCrypto } from '@/lib/masterpass-crypto';

const DATABASE_ID = 'passwordManagerDb';
const TABLE_ID = 'user_keys';

export const BYOKManager = {
  /**
   * Check if the user has unlocked their encryption vault (optional for server MEK BYOK).
   */
  isUnlocked(): boolean {
    return masterPassCrypto.isVaultUnlocked();
  },

  /**
   * Check if a key is configured for the user and provider.
   */
  async hasKey(userId: string, provider: string = 'gemini'): Promise<boolean> {
    try {
      const { hasAgentByokKeyAction } = await import('@/lib/actions/secure-ops/byok-convenience');
      return await hasAgentByokKeyAction({ provider });
    } catch (err) {
      console.error('Failed to check BYOK presence:', err);
      return false;
    }
  },

  /**
   * Securely encrypt and save an API key in Turso with KYLRIX_MEK.
   */
  async saveKey(userId: string, provider: string, rawKey: string): Promise<void> {
    const cleanKey = rawKey.trim();
    if (!cleanKey) throw new Error('API Key cannot be empty');

    const { saveAgentByokKeyAction } = await import('@/lib/actions/secure-ops/byok-convenience');
    await saveAgentByokKeyAction({
      provider: provider.toLowerCase(),
      apiKey: cleanKey,
    });
  },

  /**
   * Retrieve and decrypt the API key.
   */
  async retrieveKey(userId: string, provider: string = 'gemini'): Promise<string | null> {
    try {
      const { getDecryptedAgentByokKey } = await import('@/lib/actions/secure-ops/byok-convenience');
      return await getDecryptedAgentByokKey(userId, provider);
    } catch (err) {
      console.error('Failed to retrieve or decrypt BYOK key:', err);
      return null;
    }
  },

  /**
   * Delete the configured key.
   */
  async deleteKey(userId: string, provider: string = 'gemini'): Promise<void> {
    const { deleteAgentByokKeyAction } = await import('@/lib/actions/secure-ops/byok-convenience');
    await deleteAgentByokKeyAction({
      provider: provider.toLowerCase(),
    });
  }
};
