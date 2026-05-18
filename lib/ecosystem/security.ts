/**
 * Kylrix Ecosystem Security Protocol (WESP)
 * Centralized security and encryption logic for the entire ecosystem.
 */

import { MeshProtocol } from './mesh';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query, ID } from 'appwrite';

const PW_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const KEYCHAIN_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEYCHAIN;

export class EcosystemSecurity {
  private static instance: EcosystemSecurity;
  private masterKey: CryptoKey | null = null;
  private identityKeyPair: CryptoKeyPair | null = null;
  private identitySyncPromise: Promise<string | null> | null = null;
  private conversationKeys: Map<string, CryptoKey> = new Map();
  private decryptionCache: Map<string, string> = new Map();
  private isUnlocked = false;
  private hasMasterpassState: boolean | null = null;
  private hasPasskeyState: boolean | null = null;
  private hasRecoveryCodesState: boolean | null = null;
  private snapshotInflight: Promise<any> | null = null;
  private nodeId = 'unknown';
  private statusListeners: Set<(status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null }) => void> = new Set();
  
  private tabSessionSecret: Uint8Array | null = null;

  private static readonly PBKDF2_ITERATIONS = 600000;
  private static readonly IV_SIZE = 16; 
  private static readonly KEY_SIZE = 256;

  static getInstance(): EcosystemSecurity {
    if (!EcosystemSecurity.instance) {
      EcosystemSecurity.instance = new EcosystemSecurity();
    }
    return EcosystemSecurity.instance;
  }

  init(nodeId: string) {
    this.nodeId = nodeId;
    this.listenForMeshDirectives();
  }

  private listenForMeshDirectives() {
    if (typeof window === 'undefined') return;
    MeshProtocol.subscribe(async (msg) => {
      if (msg.type === 'COMMAND' && msg.payload.action === 'LOCK_SYSTEM') {
        this.lock();
      }
    });
  }

  private emitStatusChange() {
    const status = this.status;
    this.statusListeners.forEach((listener) => {
      try { listener(status); } catch (error) { console.warn('[Security] Status listener failed:', error); }
    });
  }

  onStatusChange(listener: (status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null }) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => { this.statusListeners.delete(listener); };
  }

  private getOrCreateSessionSecret(): Uint8Array {
    if (typeof window === 'undefined') return new Uint8Array(32);
    if (!this.tabSessionSecret) {
      this.tabSessionSecret = crypto.getRandomValues(new Uint8Array(32));
    }
    return this.tabSessionSecret;
  }

  // --- Robust Base64 (Handling URL-safe and Binary safely) ---

  private decodeBase64(base64: string): Uint8Array {
    try {
        const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        
        // Use Buffer if available (Node/Next context), else fallback to atob
        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(padded, 'base64'));
        }
        
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        throw new Error(`Invalid base64 string: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  private encodeBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    return btoa(String.fromCharCode(...bytes));
  }

  // --- Crypto Helpers ---

  public async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: EcosystemSecurity.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: EcosystemSecurity.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
  }

  public async generateRandomMEK(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

  // --- Core Encryption (String) ---

  async encryptWithKey(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    return this.encryptBinaryWithKey(encoder.encode(data), key);
  }

  async decryptWithKey(encryptedData: string, key: CryptoKey, silent = false): Promise<string> {
    const decrypted = await this.decryptBinaryWithKey(encryptedData, key, silent);
    return new TextDecoder().decode(decrypted);
  }

  // --- Core Encryption (Binary) ---

  async encryptBinaryWithKey(data: Uint8Array, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return this.encodeBase64(combined);
  }

  async decryptBinaryWithKey(encryptedData: string, key: CryptoKey, silent = false): Promise<Uint8Array> {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error("Invalid input: encryptedData must be a non-empty string");
    }

    let combined: Uint8Array;
    try {
      combined = this.decodeBase64(encryptedData);
    } catch (e) {
      if (!silent) console.error("[Security] Base64 decode failed for snippet:", encryptedData.substring(0, 16));
      throw new Error("Failed to decode base64 data");
    }

    const attemptDecrypt = async (ivSize: number) => {
        if (combined.length <= ivSize) return null;
        const iv = combined.slice(0, ivSize);
        const ciphertext = combined.slice(ivSize);
        try {
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
            return new Uint8Array(decrypted);
        } catch (err) {
            return null;
        }
    };

    // 1. Try Kylrix default (16 bytes)
    const result16 = await attemptDecrypt(EcosystemSecurity.IV_SIZE);
    if (result16 !== null) return result16;

    // 2. Try AES-GCM standard (12 bytes)
    const result12 = await attemptDecrypt(12);
    if (result12 !== null) return result12;

    if (!silent) {
        console.error("[Security] Decryption failed (Auth Tag Mismatch or Wrong Key). Length:", combined.length, "Key:", key.algorithm.name);
    }
    throw new Error("Decryption failed: auth tag mismatch (wrong key or corrupted data)");
  }

  // --- Identity & Key Wrapping ---

  async syncIdentity(userId: string) {
    if (!this.status.isUnlocked) throw new Error('Vault locked');

    const PW_DB_ID = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
    const IDENTITIES_TABLE_ID = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES;

    const res = await tablesDB.listRows(PW_DB_ID, IDENTITIES_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('identityType', 'e2e_connect'),
      Query.limit(1)
    ]);

    if (res.rows[0]) {
      const doc = res.rows[0];
      const decryptedPriv = await this.decrypt(doc.passkeyBlob);
      const privKeyBytes = this.decodeBase64(decryptedPriv);
      const pubKeyBytes = this.decodeBase64(doc.publicKey);

      const privKey = await crypto.subtle.importKey('pkcs8', privKeyBytes, { name: 'X25519' }, true, ['deriveKey', 'deriveBits']);
      const pubKey = await crypto.subtle.importKey('raw', pubKeyBytes, { name: 'X25519' }, true, []);

      this.identityKeyPair = { publicKey: pubKey, privateKey: privKey };
      this.emitStatusChange();
      return doc.publicKey;
    }

    const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveKey', 'deriveBits'])) as CryptoKeyPair;
    const privExport = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const pubExport = await crypto.subtle.exportKey('raw', pair.publicKey);

    const pubBase64 = this.encodeBase64(new Uint8Array(pubExport));
    const privBase64 = this.encodeBase64(new Uint8Array(privExport));
    const encryptedPriv = await this.encrypt(privBase64);

    await tablesDB.createRow(PW_DB_ID, IDENTITIES_TABLE_ID, ID.unique(), {
      userId,
      identityType: 'e2e_connect',
      label: 'Connect E2E Identity',
      publicKey: pubBase64,
      passkeyBlob: encryptedPriv
    });

    this.identityKeyPair = pair;
    this.emitStatusChange();
    return pubBase64;
  }

  async ensureE2EIdentity(userId: string) {
    if (!userId) throw new Error('Missing user ID');
    if (!this.identitySyncPromise) {
      this.identitySyncPromise = this.syncIdentity(userId).finally(() => { this.identitySyncPromise = null; });
    }
    return await this.identitySyncPromise;
  }

  private async deriveSharedSecret(peerPublicKeyBase64: string): Promise<CryptoKey> {
    if (!this.identityKeyPair) throw new Error("E2E Identity not initialized");
    const pubKeyBytes = this.decodeBase64(peerPublicKeyBase64);
    const peerPubKey = await crypto.subtle.importKey("raw", pubKeyBytes, { name: "X25519" }, true, []);
    return await crypto.subtle.deriveKey({ name: "X25519", public: peerPubKey }, this.identityKeyPair.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async wrapKeyWithECDH(keyToWrap: CryptoKey, peerPublicKeyBase64: string): Promise<string> {
    const sharedSecret = await this.deriveSharedSecret(peerPublicKeyBase64);
    const rawKey = await crypto.subtle.exportKey("raw", keyToWrap);
    return this.encryptBinaryWithKey(new Uint8Array(rawKey), sharedSecret);
  }

  async unwrapKeyWithECDH(wrappedKeyBase64: string, peerPublicKeyBase64: string, silent = false): Promise<CryptoKey> {
    const sharedSecret = await this.deriveSharedSecret(peerPublicKeyBase64);
    const rawKey = await this.decryptBinaryWithKey(wrappedKeyBase64, sharedSecret, silent);
    return await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  }

  // --- Vault Lifecycle ---

  public async wrapMEK(mek: CryptoKey, password: string, salt: Uint8Array): Promise<string> {
    const authKey = await this.deriveKey(password, salt);
    const mekBytes = await crypto.subtle.exportKey("raw", mek);
    return this.encryptBinaryWithKey(new Uint8Array(mekBytes), authKey);
  }

  public async unwrapMEK(wrappedKeyBase64: string, password: string, saltBase64: string): Promise<CryptoKey> {
    const salt = this.decodeBase64(saltBase64);
    const authKey = await this.deriveKey(password, salt);
    const mekBytes = await this.decryptBinaryWithKey(wrappedKeyBase64, authKey);
    return await crypto.subtle.importKey("raw", mekBytes, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  async unlock(password: string, passwordEntry: any): Promise<boolean> {
    try {
      const mek = await this.unwrapMEK(passwordEntry.wrappedKey, password, passwordEntry.salt);
      this.masterKey = mek;
      this.isUnlocked = true;
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("kylrix_vault_unlocked", "true");
      this.emitStatusChange();
      return true;
    } catch (_e) { return false; }
  }

  async encrypt(data: string): Promise<string> {
    if (!this.masterKey) throw new Error("Vault locked");
    return this.encryptWithKey(data, this.masterKey);
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) throw new Error("Vault locked");
    if (this.decryptionCache.has(encryptedData)) return this.decryptionCache.get(encryptedData)!;
    const plaintext = await this.decryptWithKey(encryptedData, this.masterKey);
    this.decryptionCache.set(encryptedData, plaintext);
    return plaintext;
  }

  lock() {
    this.masterKey = null;
    this.identityKeyPair = null;
    this.conversationKeys.clear();
    this.decryptionCache.clear();
    this.isUnlocked = false;
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("kylrix_vault_unlocked");
    this.emitStatusChange();
  }

  get status() {
    return {
      isUnlocked: this.isUnlocked,
      hasKey: !!this.masterKey,
      hasIdentity: !!this.identityKeyPair,
      hasMasterpass: this.hasMasterpassState,
      hasPasskey: this.hasPasskeyState,
      hasRecoveryCodes: this.hasRecoveryCodesState
    };
  }

  getMasterKey(): CryptoKey | null { return this.masterKey; }
}

export const ecosystemSecurity = EcosystemSecurity.getInstance();
