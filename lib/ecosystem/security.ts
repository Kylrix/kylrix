/**
 * Kylrix Ecosystem Security Protocol (WESP)
 * Centralized security and encryption logic for the entire ecosystem.
 * Hosted by the ID node (Identity Management System).
 */

import { MeshProtocol } from './mesh';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query, ID } from 'appwrite';

const PW_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;

export class EcosystemSecurity {
  private static instance: EcosystemSecurity;
  private masterKey: CryptoKey | null = null;
  private identityKeyPair: CryptoKeyPair | null = null;
  private currentUserId: string | null = null;
  private identitySyncPromise: Promise<string | null> | null = null;
  private conversationKeys: Map<string, CryptoKey> = new Map();
  private decryptionCache: Map<string, string> = new Map();
  private isUnlocked = false;
  private nodeId = 'unknown';
  private snapshotInflight: Promise<any> | null = null;
  private hasMasterpassState: boolean | null = null;
  private hasPasskeyState: boolean | null = null;
  private hasRecoveryCodesState: boolean | null = null;
  private statusListeners: Set<(status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null }) => void> = new Set();
  // SECURITY: Tab-specific secret (RAM-only) to protect against XSS
  private tabSessionSecret: Uint8Array | null = null;

  // Constants aligned with Kylrix Vault for backward compatibility
  private static readonly PBKDF2_ITERATIONS = 600000;
  private static readonly SALT_SIZE = 32;
  private static readonly IV_SIZE = 16;
  private static readonly KEY_SIZE = 256;

  // PIN specific constants
  private static readonly PIN_ITERATIONS = 100000;
  private static readonly PIN_SALT_SIZE = 16;
  private static readonly SESSION_SALT_SIZE = 16;

  static getInstance(): EcosystemSecurity {
    if (!EcosystemSecurity.instance) {
      EcosystemSecurity.instance = new EcosystemSecurity();
    }
    return EcosystemSecurity.instance;
  }

  /**
   * Initialize security for a specific node
   */
  init(nodeId: string) {
    this.nodeId = nodeId;
    this.listenForMeshDirectives();
  }

  private listenForMeshDirectives() {
    if (typeof window === 'undefined') return;
    MeshProtocol.subscribe((msg) => {
      if (msg.type === 'COMMAND' && msg.payload.action === 'LOCK_SYSTEM') {
        this.lock();
      }
    });
  }

  private emitStatusChange() {
    const status = this.status;
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.warn('[Security] Status listener failed:', error);
      }
    });
  }

  onStatusChange(listener: (status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null }) => void) {
    this.statusListeners.add(listener);
    listener(this.status);

    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async fetchSecuritySnapshot(userId: string, forceRefresh = false) {
    const resolvedUserId = String(userId || '').trim();
    if (!resolvedUserId) return this.status;
    this.currentUserId = resolvedUserId;

    if (this.snapshotInflight && !forceRefresh) {
      return this.snapshotInflight;
    }

    const snapshotPromise = (async () => {
      const [userRowsRes, keychainRowsRes] = await Promise.all([
        tablesDB.listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.USER, [
            Query.equal('userId', resolvedUserId), Query.limit(1)
        ]).catch(() => ({ rows: [] as any[] })),
        tablesDB.listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN, [
            Query.equal('userId', resolvedUserId)
        ]).catch(() => ({ rows: [] as any[] })),
      ]);

      const userDoc = (userRowsRes.rows || [])[0] || null;
      const keychainEntries = Array.isArray(keychainRowsRes.rows) ? keychainRowsRes.rows : [];

      this.hasMasterpassState = !!(userDoc?.masterpass === true || keychainEntries.some((entry: any) => entry?.type === 'password'));
      this.hasPasskeyState = !!(userDoc?.isPasskey === true || keychainEntries.some((entry: any) => entry?.type === 'passkey'));
      this.hasRecoveryCodesState = Array.isArray(userDoc?.backupCodes)
        ? userDoc.backupCodes.length > 0
        : Boolean(userDoc?.backupCodes);

      this.emitStatusChange();
      return this.status;
    })().finally(() => {
      if (this.snapshotInflight === snapshotPromise) {
        this.snapshotInflight = null;
      }
    });

    this.snapshotInflight = snapshotPromise;
    return snapshotPromise;
  }

  // --- Robust Base64 (Handling URL-safe and Binary safely) ---

  private decodeBase64(base64: string): Uint8Array {
    try {
        const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        
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
    return btoa(String.fromCharCode(...bytes));
  }

  private getOrCreateSessionSecret(): Uint8Array {
    if (typeof window === 'undefined') return new Uint8Array(32);
    if (!this.tabSessionSecret) {
      this.tabSessionSecret = crypto.getRandomValues(new Uint8Array(32));
    }
    return this.tabSessionSecret;
  }

  /**
   * Derive key from password
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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

  // Import a raw key and set it as the master key
  async importMasterKey(keyBytes: ArrayBuffer): Promise<boolean> {
    try {
      this.masterKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        true, // Make it extractable
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
      );
      this.isUnlocked = true;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("kylrix_vault_unlocked", "true");
      }
      return true;
    } catch (e: unknown) {
      console.error("[Security] Failed to import master key", e);
      return false;
    }
  }

  async setupPin(pin: string): Promise<boolean> {
    if (!this.masterKey || typeof window === "undefined") return false;

    try {
      // 1. Create PIN Verifier (for future login verification)
      const salt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.PIN_SALT_SIZE));
      const hash = await this.derivePinHash(pin, salt);
      
      const verifier = {
        salt: btoa(String.fromCharCode(...salt)),
        hash: btoa(String.fromCharCode(...new Uint8Array(hash)))
      };
      localStorage.setItem("kylrix_pin_verifier", JSON.stringify(verifier));

      // 2. Create Ephemeral Session (wrap MEK with PIN)
      const sessionSalt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.SESSION_SALT_SIZE));
      const ephemeralKey = await this.deriveEphemeralKey(pin, sessionSalt);
      
      const rawMek = await crypto.subtle.exportKey("raw", this.masterKey);
      const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));
      const wrappedMek = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        ephemeralKey,
        rawMek
      );

      const combined = new Uint8Array(iv.length + wrappedMek.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(wrappedMek), iv.length);

      const ephemeral = {
        sessionSalt: btoa(String.fromCharCode(...sessionSalt)),
        wrappedMek: btoa(String.fromCharCode(...combined))
      };
      sessionStorage.setItem("kylrix_ephemeral_session", JSON.stringify(ephemeral));
      sessionStorage.setItem("kylrix_vault_unlocked", "true");

      return true;
    } catch (e: unknown) {
      console.error("[Security] PIN setup failed", e);
      return false;
    }
  }

  async verifyPin(pin: string): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const verifierStr = localStorage.getItem("kylrix_pin_verifier");
    if (!verifierStr) return false;

    try {
      const verifier = JSON.parse(verifierStr);
      const salt = new Uint8Array(atob(verifier.salt).split("").map(c => c.charCodeAt(0)));
      const expectedHash = verifier.hash;
      const actualHash = btoa(String.fromCharCode(...new Uint8Array(await this.derivePinHash(pin, salt))));
      return actualHash === expectedHash;
    } catch (_e: unknown) {
      return false;
    }
  }

  wipePin() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("kylrix_pin_verifier");
    sessionStorage.removeItem("kylrix_ephemeral_session");
  }

  async unlock(password: string, keyChainEntry?: any): Promise<boolean> {
    try {
      if (!keyChainEntry) return false;

      const salt = new Uint8Array(
        atob(keyChainEntry.salt).split("").map(c => c.charCodeAt(0))
      );

      const authKey = await this.deriveKey(password, salt);
      const wrappedKeyBytes = new Uint8Array(
        atob(keyChainEntry.wrappedKey).split("").map(c => c.charCodeAt(0))
      );

      const iv = wrappedKeyBytes.slice(0, EcosystemSecurity.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(EcosystemSecurity.IV_SIZE);

      const mekBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        authKey,
        ciphertext
      );

      this.masterKey = await crypto.subtle.importKey(
        "raw",
        mekBytes,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      this.isUnlocked = true;

      return true;
    } catch (e: unknown) {
      console.error("[Security] Unlock failed", e);
      return false;
    }
  }

  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  async encrypt(data: string): Promise<string> {
    if (!this.masterKey) throw new Error("VAULT_LOCKED");
    
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.masterKey,
      plaintext,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) throw new Error("VAULT_LOCKED");
    if (this.decryptionCache.has(encryptedData)) return this.decryptionCache.get(encryptedData)!;

    const combined = new Uint8Array(
      atob(encryptedData).split("").map((char) => char.charCodeAt(0)),
    );

    const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
    const encrypted = combined.slice(EcosystemSecurity.IV_SIZE);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.masterKey,
      encrypted,
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    this.decryptionCache.set(encryptedData, plaintext);
    return plaintext;
  }

  async saveRecoveryIdentity(
    userId: string,
    codes: string[],
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (!this.masterKey) throw new Error("VAULT_LOCKED");
    if (!userId || !codes.length) return false;

    const encryptedPayload = await this.encrypt(JSON.stringify({
      kind: 'recovery',
      recoveryCodes: codes,
      savedAt: new Date().toISOString(),
      ...metadata,
    }));

    const tableId = APPWRITE_CONFIG.TABLES.VAULT.USER;
    const existing = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId,
      queries: [
        Query.equal('userId', userId),
        Query.limit(1),
      ],
    });

    if (existing.rows[0]) {
      await tablesDB.updateRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, existing.rows[0].$id, {
        backupCodes: encryptedPayload,
      });
      return true;
    }

    await tablesDB.createRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, ID.unique(), {
      userId,
      backupCodes: encryptedPayload,
    });
    return true;
  }

  /**
   * Phase 1: Setup PIN Verifier (Disk-Bound)
   * Stores { PinSalt, PinHash } in localStorage.
   */
  async setupPinVerifier(pin: string): Promise<void> {
    if (typeof window === "undefined") return;

    const salt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.PIN_SALT_SIZE));
    const hash = await this.derivePinHash(pin, salt);

    const verifier = {
      salt: btoa(String.fromCharCode(...salt)),
      hash: btoa(String.fromCharCode(...new Uint8Array(hash))),
    };

    localStorage.setItem("kylrix_pin_verifier", JSON.stringify(verifier));
  }

  /**
   * Phase 2: Ephemeral Wrap (RAM-Bound)
   * Wraps the MEK with an ephemeral key derived from PIN and SessionSalt.
   * Stores in sessionStorage.
   */
  async piggybackSession(pin: string): Promise<void> {
    if (!this.masterKey || typeof window === "undefined") return;

    const sessionSalt = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.SESSION_SALT_SIZE));
    const ephemeralKey = await this.deriveEphemeralKey(pin, sessionSalt);

    const rawMek = await crypto.subtle.exportKey("raw", this.masterKey);
    const iv = crypto.getRandomValues(new Uint8Array(EcosystemSecurity.IV_SIZE));

    const wrappedMek = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      ephemeralKey,
      rawMek
    );

    const combined = new Uint8Array(iv.length + wrappedMek.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(wrappedMek), iv.length);

    const ephemeralData = {
      wrappedMek: btoa(String.fromCharCode(...combined)),
      sessionSalt: btoa(String.fromCharCode(...sessionSalt)),
    };

    sessionStorage.setItem("kylrix_ephemeral_session", JSON.stringify(ephemeralData));
  }

  /**
   * Phase 3: Unlock Session with PIN
   * Reconstructs the MEK from ephemeral RAM using the PIN.
   */
  async unlockWithPin(pin: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const verifierStr = localStorage.getItem("kylrix_pin_verifier");
    const ephemeralStr = sessionStorage.getItem("kylrix_ephemeral_session");

    if (!verifierStr || !ephemeralStr) return false;

    try {
      // 1. Verify PIN against disk verifier
      const verifier = JSON.parse(verifierStr);
      const salt = new Uint8Array(atob(verifier.salt).split("").map(c => c.charCodeAt(0)));
      const expectedHash = verifier.hash;
      const actualHash = btoa(String.fromCharCode(...new Uint8Array(await this.derivePinHash(pin, salt))));

      if (actualHash !== expectedHash) {
        return false;
      }

      // 2. Unwrap MEK from ephemeral storage
      const ephemeral = JSON.parse(ephemeralStr);
      const sessionSalt = new Uint8Array(atob(ephemeral.sessionSalt).split("").map(c => c.charCodeAt(0)));
      const ephemeralKey = await this.deriveEphemeralKey(pin, sessionSalt);

      const wrappedMekBytes = new Uint8Array(atob(ephemeral.wrappedMek).split("").map(c => c.charCodeAt(0)));
      const iv = wrappedMekBytes.slice(0, EcosystemSecurity.IV_SIZE);
      const ciphertext = wrappedMekBytes.slice(EcosystemSecurity.IV_SIZE);

      const rawMek = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        ephemeralKey,
        ciphertext
      );

      this.masterKey = await crypto.subtle.importKey(
        "raw",
        rawMek,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      this.isUnlocked = true;
      return true;
    } catch (e: unknown) {
      console.error("[Security] PIN unlock failed", e);
      return false;
    }
  }

  isPinSet(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("kylrix_pin_verifier");
  }

  private async derivePinHash(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    return crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: EcosystemSecurity.PIN_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
  }

  private async deriveEphemeralKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const sessionSecret = this.getOrCreateSessionSecret();
    
    // Mix PIN with tab-specific Session Secret for entropy (XSS-safe)
    const pinBytes = encoder.encode(pin);
    const combined = new Uint8Array(pinBytes.length + sessionSecret.length);
    combined.set(pinBytes);
    combined.set(sessionSecret, pinBytes.length);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      combined,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: 10000, // Optimized for instant (<20ms) unlock speed
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, // SECURITY: Non-extractable. Key cannot be exported by XSS.
      ["encrypt", "decrypt"]
    );
  }

  async syncIdentity(userId: string) {
    if (!this.masterKey) throw new Error('Vault locked');

    const res = await tablesDB.listRows({
      databaseId: PW_DB,
      tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
      queries: [
        Query.equal('userId', userId),
        Query.equal('identityType', 'e2e_connect'),
        Query.limit(1)
      ]
    });

    if (res.rows[0]) {
      const doc = res.rows[0];
      const decryptedPriv = await this.decrypt(doc.passkeyBlob);
      const privKeyBytes = this.decodeBase64(decryptedPriv);
      const pubKeyBytes = this.decodeBase64(doc.publicKey);

      const privKey = await crypto.subtle.importKey('pkcs8', privKeyBytes as BufferSource, { name: 'X25519' }, true, ['deriveKey', 'deriveBits']);
      const pubKey = await crypto.subtle.importKey('raw', pubKeyBytes as BufferSource, { name: 'X25519' }, true, []);

      this.identityKeyPair = { publicKey: pubKey, privateKey: privKey };
      this.currentUserId = userId;
      this.emitStatusChange();
      return doc.publicKey;
    }

    const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveKey', 'deriveBits'])) as CryptoKeyPair;
    const privExport = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const pubExport = await crypto.subtle.exportKey('raw', pair.publicKey);

    const pubBase64 = this.encodeBase64(new Uint8Array(pubExport));
    const privBase64 = this.encodeBase64(new Uint8Array(privExport));
    const encryptedPriv = await this.encrypt(privBase64);

    await tablesDB.createRow(PW_DB, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES, ID.unique(), {
      userId,
      identityType: 'e2e_connect',
      label: 'Connect E2E Identity',
      publicKey: pubBase64,
      passkeyBlob: encryptedPriv
    });

    this.identityKeyPair = pair;
    this.currentUserId = userId;
    this.emitStatusChange();
    return pubBase64;
  }

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

    const targetRaw = this.decodeBase64(targetPublicKeyBase64);
    
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

  async unwrapKeyWithECDH(wrappedKeyBase64: string, ownerPublicKeyBase64: string): Promise<CryptoKey> {
    const sharedKey = await this.deriveSharedSecret(ownerPublicKeyBase64);
    const combined = this.decodeBase64(wrappedKeyBase64);

    const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
    const ciphertext = combined.slice(EcosystemSecurity.IV_SIZE);

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
}

export const ecosystemSecurity = EcosystemSecurity.getInstance();
