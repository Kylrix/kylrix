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

class EcosystemSecurity {
  private static instance: EcosystemSecurity;
  private masterKey: CryptoKey | null = null;
  private identityKeyPair: CryptoKeyPair | null = null;
  private currentUserId: string | null = null;
  private identitySyncPromise: Promise<string | null> | null = null;
  private conversationKeys: Map<string, CryptoKey> = new Map();
  private agentMekCache: Map<string, CryptoKey> = new Map();
  private decryptionCache: Map<string, string> = new Map();
  private isUnlocked = false;
  private nodeId = 'unknown';
  private snapshotInflight: Promise<any> | null = null;
  private hasMasterpassState: boolean | null = null;
  private hasPasskeyState: boolean | null = null;
  private hasRecoveryCodesState: boolean | null = null;
  private passkeyReminderAtState: string | null = null;
  private isArgonState: boolean | null = null;
  private statusListeners: Set<(status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null; passkeyReminderAt: string | null; isArgon: boolean | null }) => void> = new Set();
  // Transient tab secret for privacy-respecting handling of private notes and secure hangouts
  private tabSessionSecret: Uint8Array | null = null;

  // Constants aligned with Kylrix Vault for backward compatibility
  private static readonly PBKDF2_ITERATIONS = 600000;
  private static readonly SALT_SIZE = 32;
  private static readonly IV_SIZE = 16;
  private static readonly KEY_SIZE = 256;

  // Argon2id Parameters
  private static readonly ARGON2_MEMORY = 65536; // 64 MB
  private static readonly ARGON2_ITERATIONS = 3;
  private static readonly ARGON2_PARALLELISM = 4;

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

  onStatusChange(listener: (status: { isUnlocked: boolean; hasKey: boolean; hasIdentity: boolean; hasMasterpass: boolean | null; hasPasskey: boolean | null; hasRecoveryCodes: boolean | null; passkeyReminderAt: string | null; isArgon: boolean | null }) => void) {
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
      const { SecurityEnclave } = await import('@/lib/security/enclave');

      // 1) Instant local hydrate — never block unlock UI on network
      let keychainEntries = await SecurityEnclave.getKeychain(resolvedUserId);
      let userDoc = await SecurityEnclave.getUserDoc(resolvedUserId);

      this.hasMasterpassState = !!(
        userDoc?.masterpass === true ||
        keychainEntries.some((entry: any) => entry?.type === 'password')
      );
      this.hasPasskeyState = !!(
        userDoc?.isPasskey === true ||
        keychainEntries.some((entry: any) => entry?.type === 'passkey')
      );
      this.hasRecoveryCodesState = Array.isArray(userDoc?.backupCodes)
        ? userDoc.backupCodes.length > 0
        : Boolean(userDoc?.backupCodes);
      this.passkeyReminderAtState = userDoc?.passkey_reminder_at || null;
      const passwordEntryLocal = keychainEntries.find((entry: any) => entry?.type === 'password');
      this.isArgonState = passwordEntryLocal ? !!passwordEntryLocal.isArgon : false;
      this.emitStatusChange();

      // 2) Background / forced remote refresh into enclave
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!offline) {
        try {
          await SecurityEnclave.hydrateFromRemote(resolvedUserId, { force: forceRefresh });
          keychainEntries = await SecurityEnclave.getKeychain(resolvedUserId);
          userDoc = await SecurityEnclave.getUserDoc(resolvedUserId);

          this.hasMasterpassState = !!(
            userDoc?.masterpass === true ||
            keychainEntries.some((entry: any) => entry?.type === 'password')
          );
          this.hasPasskeyState = !!(
            userDoc?.isPasskey === true ||
            keychainEntries.some((entry: any) => entry?.type === 'passkey')
          );
          this.hasRecoveryCodesState = Array.isArray(userDoc?.backupCodes)
            ? userDoc.backupCodes.length > 0
            : Boolean(userDoc?.backupCodes);
          this.passkeyReminderAtState = userDoc?.passkey_reminder_at || null;
          const passwordEntry = keychainEntries.find((entry: any) => entry?.type === 'password');
          this.isArgonState = passwordEntry ? !!passwordEntry.isArgon : false;
          this.emitStatusChange();
        } catch (err) {
          console.warn('[Security] Remote snapshot refresh failed; local enclave remains SoT:', err);
        }
      }

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

  public decodeBase64(base64: string): Uint8Array {
    try {
      return decodeBase64ToBytes(base64);
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'unknown';
      if (detail.startsWith('INVALID_BASE64:')) {
        throw new Error(`Invalid base64 string: ${detail.slice('INVALID_BASE64:'.length)}`);
      }
      if (detail === 'INVALID_PUBLIC_KEY_FORMAT') {
        throw new Error('Invalid public key format');
      }
      throw new Error(`Invalid base64 string: ${detail}`);
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
   * Derive key from master password using Argon2id (Primary)
   */
  private async deriveKeyWithArgon2id(
    password: string,
    salt: Uint8Array): Promise<CryptoKey> {
    const { argon2id } = await import('hash-wasm');
    const hash = await argon2id({
      password,
      salt,
      parallelism: EcosystemSecurity.ARGON2_PARALLELISM,
      iterations: EcosystemSecurity.ARGON2_ITERATIONS,
      memorySize: EcosystemSecurity.ARGON2_MEMORY,
      hashLength: 32, // 256 bits
      outputType: 'binary'});

    return crypto.subtle.importKey(
      "raw",
      hash as any,
      { name: "AES-GCM", length: EcosystemSecurity.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  /**
   * Derive key from password using PBKDF2 (Legacy)
   */
  private async deriveKeyPBKDF2(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]);

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: EcosystemSecurity.PBKDF2_ITERATIONS,
        hash: "SHA-256"},
      keyMaterial,
      { name: "AES-GCM", length: EcosystemSecurity.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  private async deriveKey(password: string, salt: Uint8Array, useArgon = true): Promise<CryptoKey> {
    if (useArgon) {
        return this.deriveKeyWithArgon2id(password, salt);
    }
    return this.deriveKeyPBKDF2(password, salt);
  }

  clearDecryptionCache(): void {
    this.decryptionCache.clear();
  }

  // Import a raw key and set it as the master key
  async importMasterKey(keyBytes: ArrayBuffer): Promise<boolean> {
    try {
      this.masterKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        true, // Make it extractable
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
      this.isUnlocked = true;
      this.clearDecryptionCache();
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("kylrix_vault_unlocked", "true");
        sessionStorage.setItem("vault_unlocked", Date.now().toString());
      }
      this.emitStatusChange();
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

      const isArgon = !!keyChainEntry.isArgon || (typeof keyChainEntry.params === 'string' ? keyChainEntry.params.includes("Argon2id") : keyChainEntry.params?.algo === 'Argon2id');

      // Derive AuthKey using the stored salt
      const salt = this.decodeBase64(keyChainEntry.salt);
      const authKey = await this.deriveKey(password, salt, isArgon);

      const wrappedKeyBytes = this.decodeBase64(keyChainEntry.wrappedKey);

      const iv = wrappedKeyBytes.slice(0, EcosystemSecurity.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(EcosystemSecurity.IV_SIZE);

      let mekBytes: ArrayBuffer | null = null;
      try {
        mekBytes = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          authKey,
          ciphertext
        );
      } catch {
        if (isArgon) {
          try {
            const fallbackKey = await this.deriveKey(password, salt, false);
            mekBytes = await crypto.subtle.decrypt(
              { name: "AES-GCM", iv: iv },
              fallbackKey,
              ciphertext
            );
          } catch {}
        }
      }

      if (!mekBytes) return false;

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
    if (!this.masterKey && typeof window !== 'undefined') {
      try {
        const { masterPassCrypto } = require('@/lib/masterpass-crypto');
        const mk = masterPassCrypto.getMasterKey?.();
        if (mk) {
          this.masterKey = mk;
          this.isUnlocked = true;
        }
      } catch {}
    }
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
      plaintext);

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) throw new Error("VAULT_LOCKED");
    if (this.decryptionCache.has(encryptedData)) return this.decryptionCache.get(encryptedData)!;

    const combined = new Uint8Array(
      atob(encryptedData).split("").map((char: any) => char.charCodeAt(0)));

    const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
    const encrypted = combined.slice(EcosystemSecurity.IV_SIZE);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      this.masterKey,
      encrypted);

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    this.decryptionCache.set(encryptedData, plaintext);
    return plaintext;
  }

  /**
   * Resolves and caches the MEK for a specific agent.
   */
  async getAgentMek(agentId: string): Promise<CryptoKey | null> {
    const cleanId = agentId.replace(/^agent_/, '');
    if (this.agentMekCache.has(cleanId)) {
      return this.agentMekCache.get(cleanId)!;
    }
    try {
      // 1. Resolve sealed keyblob or hex from privileged Server Action
      const { resolveAgentKeyBlobSecure } = await import('@/lib/actions/secure-ops/projects');
      const blobRes = await resolveAgentKeyBlobSecure(cleanId).catch(() => null);

      if (blobRes?.success) {
        // A. If encryptedKeyBlob is returned, unwrap it using Owner Masterpass MEK (Gold Key -> Silver Key)
        if (blobRes.encryptedKeyBlob && (this.masterKey || this.status.isUnlocked)) {
          try {
            const decryptedSecret = await this.decrypt(blobRes.encryptedKeyBlob);
            const parsed = JSON.parse(decryptedSecret);
            const hex = parsed.mekHex || parsed.entropyHex;
            if (hex) {
              const { importMekCryptoKey, parseMekToBytes } = await import('@/lib/api/vault-crypto');
              const key = await importMekCryptoKey(parseMekToBytes(hex));
              if (key) {
                this.agentMekCache.set(cleanId, key);
                return key;
              }
            }
          } catch (unwrapErr) {
            console.warn('[EcosystemSecurity] Failed to unwrap agent encryptedKeyBlob:', unwrapErr);
          }
        }

        // B. If direct mekHex is available
        if (blobRes.mekHex) {
          try {
            const { importMekCryptoKey, parseMekToBytes } = await import('@/lib/api/vault-crypto');
            const key = await importMekCryptoKey(parseMekToBytes(blobRes.mekHex));
            if (key) {
              this.agentMekCache.set(cleanId, key);
              return key;
            }
          } catch {}
        }
      }

      // 2. Fallback to AgentIdentityService
      const { AgentIdentityService } = await import('@/lib/services/agent-identity');
      const key = await AgentIdentityService.getAgentCryptoKey(cleanId);
      if (key) {
        this.agentMekCache.set(cleanId, key);
        return key;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the appropriate MEK for the given workspace.
   * If the workspace is agentic, retrieves the agent's MEK; otherwise returns user's masterKey.
   */
  async resolveWorkspaceMek(workspace?: { isAgentic?: boolean; agentId?: string | null; id?: string; ownerId?: string; metadata?: any } | null): Promise<CryptoKey | null> {
    if (workspace?.isAgentic) {
      let agentId = workspace.agentId;
      if (!agentId && workspace.metadata) {
        try {
          const meta = typeof workspace.metadata === 'string' ? JSON.parse(workspace.metadata) : workspace.metadata;
          if (meta.agentId) agentId = meta.agentId;
        } catch {}
      }
      if (!agentId && workspace.ownerId && workspace.ownerId.startsWith('agent_')) {
        agentId = workspace.ownerId.replace(/^agent_/, '');
      }
      if (!agentId && workspace.id) {
        agentId = workspace.id;
      }
      if (agentId) {
        const agentKey = await this.getAgentMek(agentId);
        if (agentKey) return agentKey;
      }
    }
    return this.masterKey;
  }

  /**
   * Seamless workspace-aware decryption supporting agentic workspaces, DEK wrappers, and standard vault payloads.
   */
  async decryptWithWorkspace(
    encryptedData: string,
    workspace?: { isAgentic?: boolean; agentId?: string | null; id?: string; ownerId?: string; metadata?: any } | null,
    wrappedDek?: string | null
  ): Promise<string> {
    if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
    if (this.decryptionCache.has(encryptedData)) return this.decryptionCache.get(encryptedData)!;

    const masterKey = this.getMasterKey();

    const isAgentic = Boolean(
      workspace?.isAgentic === true ||
      (workspace?.metadata && (typeof workspace.metadata === 'string' ? workspace.metadata.includes('"isAgentic":true') : workspace.metadata?.isAgentic === true)) ||
      (workspace?.ownerId && String(workspace.ownerId).startsWith('agent_'))
    );

    // 1. Direct User MEK First for Non-Agentic / Personal Workspaces
    if (!isAgentic && masterKey) {
      if (wrappedDek) {
        try {
          const dekBytes = atob(wrappedDek).split('').map((c) => c.charCodeAt(0));
          const dekIv = new Uint8Array(dekBytes.slice(0, EcosystemSecurity.IV_SIZE));
          const dekEncrypted = new Uint8Array(dekBytes.slice(EcosystemSecurity.IV_SIZE));
          const rawDek = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dekIv }, masterKey, dekEncrypted);
          const itemKey = await crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);

          const dataBytes = atob(encryptedData).split('').map((c) => c.charCodeAt(0));
          const dataIv = new Uint8Array(dataBytes.slice(0, EcosystemSecurity.IV_SIZE));
          const dataEncrypted = new Uint8Array(dataBytes.slice(EcosystemSecurity.IV_SIZE));
          const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dataIv }, itemKey, dataEncrypted);
          const plaintext = new TextDecoder().decode(decrypted);
          this.decryptionCache.set(encryptedData, plaintext);
          return plaintext;
        } catch {}
      }

      try {
        const combined = new Uint8Array(
          atob(encryptedData).split("").map((char: any) => char.charCodeAt(0))
        );
        const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
        const encrypted = combined.slice(EcosystemSecurity.IV_SIZE);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, masterKey, encrypted);
        const plaintext = new TextDecoder().decode(decrypted);
        this.decryptionCache.set(encryptedData, plaintext);
        return plaintext;
      } catch {}
    }

    // 2. Hierarchical Agent MEK Resolution for Agentic Workspaces
    let keyToUse = masterKey;
    if (isAgentic) {
      const agentKey = await this.resolveWorkspaceMek(workspace);
      if (agentKey) {
        keyToUse = agentKey;
      }
    }

    if (!keyToUse) {
      throw new Error("VAULT_LOCKED");
    }

    // A. If wrappedDek is present, unwrap DEK and decrypt payload
    if (wrappedDek) {
      try {
        const dekBytes = atob(wrappedDek).split('').map((c) => c.charCodeAt(0));
        const dekIv = new Uint8Array(dekBytes.slice(0, EcosystemSecurity.IV_SIZE));
        const dekEncrypted = new Uint8Array(dekBytes.slice(EcosystemSecurity.IV_SIZE));
        const rawDek = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dekIv }, keyToUse, dekEncrypted);
        const itemKey = await crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);

        const dataBytes = atob(encryptedData).split('').map((c) => c.charCodeAt(0));
        const dataIv = new Uint8Array(dataBytes.slice(0, EcosystemSecurity.IV_SIZE));
        const dataEncrypted = new Uint8Array(dataBytes.slice(EcosystemSecurity.IV_SIZE));
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dataIv }, itemKey, dataEncrypted);
        const plaintext = new TextDecoder().decode(decrypted);
        this.decryptionCache.set(encryptedData, plaintext);
        return plaintext;
      } catch {}
    }

    // B. Direct decryption with workspace key
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split("").map((char: any) => char.charCodeAt(0))
      );
      const iv = combined.slice(0, EcosystemSecurity.IV_SIZE);
      const encrypted = combined.slice(EcosystemSecurity.IV_SIZE);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, keyToUse, encrypted);
      const plaintext = new TextDecoder().decode(decrypted);
      this.decryptionCache.set(encryptedData, plaintext);
      return plaintext;
    } catch (directErr) {
      // Fallback: If agentic decryption failed, try masterKey fallback if different
      if (keyToUse !== masterKey && masterKey) {
        try {
          return await this.decrypt(encryptedData);
        } catch {}
      }
      throw directErr;
    }
  }

  async saveRecoveryIdentity(
    userId: string,
    codes: string[],
    metadata: Record<string, unknown> = {}): Promise<boolean> {
    if (!this.masterKey) throw new Error("VAULT_LOCKED");
    if (!userId || !codes.length) return false;

    const encryptedPayload = await this.encrypt(JSON.stringify({
      kind: 'recovery',
      recoveryCodes: codes,
      savedAt: new Date().toISOString(),
      ...metadata}));

    const tableId = APPWRITE_CONFIG.TABLES.VAULT.USER;
    const existing = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId,
      queries: [
        Query.equal('userId', userId),
        Query.limit(1)]});

    if (existing.rows[0]) {
      await tablesDB.updateRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, existing.rows[0].$id, {
        backupCodes: encryptedPayload});
      return true;
    }

    await tablesDB.createRow(APPWRITE_CONFIG.DATABASES.VAULT, tableId, ID.unique(), {
      userId,
      backupCodes: encryptedPayload});
    return true;
  }

  async loadRecoveryIdentity(userId: string): Promise<string[] | null> {
    if (!this.masterKey) throw new Error('VAULT_LOCKED');
    if (!userId) return null;

    const tableId = APPWRITE_CONFIG.TABLES.VAULT.USER;
    const existing = await tablesDB.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId,
      queries: [
        Query.equal('userId', userId),
        Query.limit(1)]});

    const payload = existing.rows[0]?.backupCodes;
    if (!payload || typeof payload !== 'string') {
      return null;
    }

    try {
      const decrypted = await this.decrypt(payload);
      const parsed = JSON.parse(decrypted) as {
        kind?: string;
        recoveryCodes?: string[];
      };
      if (parsed.kind !== 'recovery' || !Array.isArray(parsed.recoveryCodes)) {
        return null;
      }
      return parsed.recoveryCodes.filter(Boolean);
    } catch {
      return null;
    }
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
      hash: btoa(String.fromCharCode(...new Uint8Array(hash)))};

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
      sessionSalt: btoa(String.fromCharCode(...sessionSalt))};

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
        hash: "SHA-256"},
      keyMaterial,
      256
    );
  }

  private async deriveEphemeralKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const sessionSecret = this.getOrCreateSessionSecret();
    
    // Mix PIN with transient session secret for a pleasant privacy-respecting experience
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
        hash: "SHA-256"},
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, // Privacy-respecting: key stays in transient memory for this session
      ["encrypt", "decrypt"]
    );
  }

  async syncIdentity(userId: string) {
    if (!this.masterKey) throw new Error('Vault locked');

    const { SecurityEnclave, raceNetworkOrLocal } = await import('@/lib/security/enclave');

    const loadFromRow = async (doc: any) => {
      const decryptedPrivRaw = await this.decrypt(doc.passkeyBlob);
      const decryptedPriv = normalizeStoredSecretString(decryptedPrivRaw);

      let privKeyBytes: Uint8Array;
      let pubKeyBytes: Uint8Array;
      try {
        privKeyBytes = this.decodeBase64(decryptedPriv);
        pubKeyBytes = this.decodeBase64(doc.publicKey);
      } catch (error) {
        console.error('[Security] Failed to decode stored E2E identity keys:', error);
        throw new Error('Your secure identity keys could not be loaded. Unlock your vault in Settings and try again.');
      }

      const privKey = await crypto.subtle.importKey('pkcs8', privKeyBytes as BufferSource, { name: 'X25519' }, true, ['deriveKey', 'deriveBits']);
      const pubKey = await crypto.subtle.importKey('raw', pubKeyBytes as BufferSource, { name: 'X25519' }, true, []);

      this.identityKeyPair = { publicKey: pubKey, privateKey: privKey };
      this.currentUserId = userId;
      this.emitStatusChange();
      return doc.publicKey as string;
    };

    // Local-first: encrypted identity blob already in enclave
    const localIdentity = await SecurityEnclave.getIdentity(userId);
    if (localIdentity?.passkeyBlob && localIdentity?.publicKey) {
      try {
        return await loadFromRow(localIdentity);
      } catch (e) {
        console.warn('[Security] Local identity decrypt failed, trying remote:', e);
      }
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
      throw new Error('Secure chat identity is not available offline yet. Connect once to sync it.');
    }

    const { value: res } = await raceNetworkOrLocal({
      timeoutMs: 4000,
      network: async () =>
        tablesDB.listRows({
          databaseId: PW_DB,
          tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
          queries: [
            Query.equal('userId', userId),
            Query.equal('identityType', 'e2e_connect'),
            Query.limit(1),
          ]}),
      local: async () => ({ rows: localIdentity ? [localIdentity] : [] })});

    if (res.rows[0]) {
      const doc = res.rows[0];
      await SecurityEnclave.setIdentity(userId, doc);
      return await loadFromRow(doc);
    }

    // Create only when online and missing
    const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveKey', 'deriveBits'])) as CryptoKeyPair;
    const privExport = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    const pubExport = await crypto.subtle.exportKey('raw', pair.publicKey);

    const pubBase64 = this.encodeBase64(new Uint8Array(pubExport));
    const privBase64 = this.encodeBase64(new Uint8Array(privExport));
    const encryptedPriv = await this.encrypt(privBase64);

    const created = await tablesDB.createRow(PW_DB, APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES, ID.unique(), {
      userId,
      identityType: 'e2e_connect',
      label: 'Connect E2E Identity',
      publicKey: pubBase64,
      passkeyBlob: encryptedPriv
    });

    await SecurityEnclave.setIdentity(userId, created);

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
