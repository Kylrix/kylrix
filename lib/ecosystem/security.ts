/**
 * Kylrix Ecosystem Security Protocol (WESP)
 * Centralized security and encryption logic for the entire ecosystem.
 * Hosted by the ID node (Identity Management System).
 */

import { MeshProtocol } from './mesh';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query, ID } from 'appwrite';
import { decodeBase64ToBytes, normalizeStoredSecretString } from '@/lib/crypto/public-key';

const PW_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;

import { EcosystemSecurityBase } from './security-base';
export class EcosystemSecurity extends EcosystemSecurityBase {
  async ensureE2EIdentity(userId: string) {
    if (!userId) throw new Error('Missing user ID');
    if (typeof window === 'undefined') return null;

    if (userId && this.currentUserId && userId !== this.currentUserId) {
      try {
        const { resolveIdentityById } = await import('@/lib/identity-cache');
        const { UsersService } = await import('@/lib/services/users');
        const identity = await resolveIdentityById(userId, () => UsersService.getProfileById(userId));
        return identity?.publicKey || null;
      } catch (e) {
        console.warn('[Security] Failed to resolve identity for user:', userId, e);
        return null;
      }
    }

    if (!this.masterKey) {
      throw new Error('Vault locked');
    }

    if (this.identityKeyPair && (!userId || userId === this.currentUserId)) {
      return await this.exportIdentityPublicKey();
    }

    if (!this.identitySyncPromise) {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) return null;

      this.identitySyncPromise = this.syncIdentity(targetUserId).finally(() => {
        this.identitySyncPromise = null;
      });
    }

    return await this.identitySyncPromise;
  }

  async exportIdentityPublicKey(): Promise<string | null> {
    if (!this.identityKeyPair) return null;
    const exported = await crypto.subtle.exportKey('raw', this.identityKeyPair.publicKey);
    return this.encodeBase64(new Uint8Array(exported));
  }

  async generateRandomMEK(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
  }

  private async deriveSharedSecret(targetPublicKeyBase64: string): Promise<CryptoKey> {
    if (!this.identityKeyPair) throw new Error("E2E Identity not initialized");

    let targetRaw: Uint8Array;
    try {
      targetRaw = this.decodeBase64(targetPublicKeyBase64);
    } catch (error) {
      console.error('[Security] Failed to decode recipient public key:', error);
      throw new Error("This person hasn't completed secure chat setup, or their public key is invalid.");
    }
    
    if (targetRaw.length !== 32) {
        throw new Error(`X25519 target key must be 32 bytes (256 bits). Received ${targetRaw.length} bytes. The recipient's public key might be corrupted or in an unsupported format.`);
    }

    const targetKey = await crypto.subtle.importKey(
        "raw",
        targetRaw as BufferSource,
        { name: "X25519" },
        true,
        []
    );

    return await crypto.subtle.deriveKey(
        { name: "X25519", public: targetKey },
        this.identityKeyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
  }

  async wrapKeyWithECDH(keyToWrap: CryptoKey, targetPublicKeyBase64: string): Promise<string> {
    const sharedKey = await this.deriveSharedSecret(targetPublicKeyBase64);
    const rawKey = await crypto.subtle.exportKey("raw", keyToWrap);
    
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        rawKey
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return this.encodeBase64(combined);
  }

  async unwrapKeyWithECDH(wrappedKeyBase64: string, ownerPublicKeyBase64: string, ivSize: number = EcosystemSecurity.IV_SIZE): Promise<CryptoKey> {
    const sharedKey = await this.deriveSharedSecret(ownerPublicKeyBase64);
    const combined = this.decodeBase64(wrappedKeyBase64);

    const iv = combined.slice(0, ivSize);
    const ciphertext = combined.slice(ivSize);

    const rawKey = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        ciphertext
    );

    return await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
  }

  /** Try standard 16-byte IV, then legacy 12-byte IV. */
  async unwrapKeyWithECDHFlexible(
    wrappedKeyBase64: string,
    ownerPublicKeyBase64: string,
  ): Promise<CryptoKey | null> {
    for (const ivSize of [EcosystemSecurity.IV_SIZE, 12]) {
      try {
        return await this.unwrapKeyWithECDH(wrappedKeyBase64, ownerPublicKeyBase64, ivSize);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async encryptBinaryWithKey(data: Uint8Array, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data as BufferSource
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async encryptWithKey(data: string, key: CryptoKey): Promise<string> {
    return this.encryptBinaryWithKey(new TextEncoder().encode(data), key);
  }

  async decryptBinaryWithKey(encryptedBase64: string, key: CryptoKey, isRaw: boolean = false): Promise<Uint8Array | string> {
    const combined = new Uint8Array(atob(encryptedBase64).split("").map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
    const ciphertext = combined.slice(EcosystemSecurity.IV_SIZE);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    );

    if (isRaw) return new Uint8Array(decrypted);
    return new TextDecoder().decode(decrypted);
  }

  async decryptWithKey(encryptedBase64: string, key: CryptoKey, isRaw: boolean = false): Promise<string> {
    const res = await this.decryptBinaryWithKey(encryptedBase64, key, isRaw);
    return typeof res === 'string' ? res : new TextDecoder().decode(res);
  }

  async decryptWithECDH(wrappedKeyBase64: string, ownerPublicKeyBase64: string, ivSize: number = 12): Promise<string> {
    const sharedKey = await this.deriveSharedSecret(ownerPublicKeyBase64);
    const combined = this.decodeBase64(wrappedKeyBase64);

    const iv = combined.slice(0, ivSize);
    const ciphertext = combined.slice(ivSize);

    const raw = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        ciphertext
    );

    return new TextDecoder().decode(raw);
  }

  async fetchKeychain(userId: string): Promise<any | null> {
    const { SecurityEnclave, raceNetworkOrLocal } = await import('@/lib/security/enclave');

    const pickPassword = (rows: any[]) => {
      if (!rows.length) return null;
      const passwordEntries = rows.filter((r: any) => r.type === 'password');
      if (passwordEntries.length === 0) return rows[0];
      return passwordEntries.find((r: any) => !r.isPending) || passwordEntries[0];
    };

    const localRows = await SecurityEnclave.getKeychain(userId);
    const localPick = pickPassword(localRows);

    // Offline or already cached: unlock from enclave immediately
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return localPick;
    }
    if (localPick) {
      // Refresh in background; do not block unlock
      void SecurityEnclave.hydrateFromRemote(userId).catch(() => {});
      return localPick;
    }

    const { value: rows } = await raceNetworkOrLocal({
      timeoutMs: 2500,
      network: async () => {
        const res = await tablesDB.listRows(
          APPWRITE_CONFIG.DATABASES.VAULT,
          APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
          [Query.equal('userId', userId), Query.limit(50)]);
        return res.rows || [];
      },
      local: async () => localRows});

    if (Array.isArray(rows) && rows.length > 0) {
      await SecurityEnclave.setKeychain(userId, rows);
    }
    return pickPassword(rows);
  }

  getConversationKey(conversationId: string): CryptoKey | null {
    return this.conversationKeys.get(conversationId) || null;
  }

  setConversationKey(conversationId: string, key: CryptoKey) {
    this.conversationKeys.set(conversationId, key);
  }

  async generateConversationKey(): Promise<CryptoKey> {
    return await this.generateRandomMEK();
  }

  clearConversationKey(conversationId: string) {
    this.conversationKeys.delete(conversationId);
  }

  lock() {
    this.masterKey = null;
    this.identityKeyPair = null;
    this.conversationKeys.clear();
    this.decryptionCache.clear();
    this.isUnlocked = false;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }
    // Never leave plaintext vault/TOTP lists on disk after lock.
    if (typeof window !== "undefined" && this.currentUserId) {
      const uid = this.currentUserId;
      void import("@/lib/services/LocalEngine")
        .then(({ LocalEngine }) =>
          Promise.all([
            LocalEngine.cacheDelete(`f_decrypted_totps_${uid}`),
            LocalEngine.cacheDelete(`f_decrypted_vault_${uid}`),
          ]),
        )
        .catch(() => undefined);
    }
    this.emitStatusChange();
  }

  async setPasskeyReminder(userId: string, date: Date | null) {
    const tableId = APPWRITE_CONFIG.TABLES.VAULT.USER;
    const existing = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId,
      queries: [
        Query.equal('userId', userId),
        Query.limit(1)]});

    const reminderAt = date ? date.toISOString() : null;

    if (existing.rows[0]) {
      await tablesDB.updateRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, existing.rows[0].$id, {
        passkey_reminder_at: reminderAt});
    } else {
      await tablesDB.createRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, ID.unique(), {
        userId,
        passkey_reminder_at: reminderAt});
    }
    
    this.passkeyReminderAtState = reminderAt;
    this.emitStatusChange();
  }

  get status() {
    return {
      isUnlocked: this.isUnlocked,
      hasKey: !!this.masterKey,
      hasIdentity: !!this.identityKeyPair,
      hasMasterpass: this.hasMasterpassState,
      hasPasskey: this.hasPasskeyState,
      hasRecoveryCodes: this.hasRecoveryCodesState,
      passkeyReminderAt: this.passkeyReminderAtState,
      isArgon: this.isArgonState
    };
  }
}

export const ecosystemSecurity = EcosystemSecurity.getInstance();
