import { logDebug, logError } from '@/lib/logger';
import { markSudoActive, resetSudo } from '@/lib/sudo-mode';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

// Enhanced crypto configuration for maximum security with optimal performance
export class MasterPassCryptoBase {
  private static instance: MasterPassCrypto;
  private masterKey: CryptoKey | null = null;
  private isUnlocked = false;
  private static readonly DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes default

  static getInstance(): MasterPassCrypto {
    if (!MasterPassCrypto.instance) {
      MasterPassCrypto.instance = new MasterPassCrypto();
    }
    return MasterPassCrypto.instance;
  }

  // Enhanced configuration constants
  private static readonly PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation
  private static readonly SALT_SIZE = 32; // 256-bit salt
  private static readonly IV_SIZE = 16; // 128-bit IV for AES-GCM
  private static readonly KEY_SIZE = 256; // 256-bit key for AES-256

  // Argon2id Parameters
  private static readonly ARGON2_MEMORY = 65536; // 64 MB
  private static readonly ARGON2_ITERATIONS = 3;
  private static readonly ARGON2_PARALLELISM = 4;
  
  private onMigrationStart?: () => void;
  private onMigrationEnd?: (success: boolean) => void;

  setMigrationCallbacks(start: () => void, end: (success: boolean) => void) {
      this.onMigrationStart = start;
      this.onMigrationEnd = end;
  }

  // Derive key from master password using Argon2id (Primary)
  private async deriveKeyWithArgon2id(
    password: string,
    salt: Uint8Array): Promise<CryptoKey> {
    const { argon2id } = await import('hash-wasm');
    const hash = await argon2id({
      password,
      salt,
      parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
      iterations: MasterPassCrypto.ARGON2_ITERATIONS,
      memorySize: MasterPassCrypto.ARGON2_MEMORY,
      hashLength: 32, // 256 bits
      outputType: 'binary'});

    return crypto.subtle.importKey(
      "raw",
      hash as any,
      { name: "AES-GCM", length: MasterPassCrypto.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  // Derive key from master password using PBKDF2 (Legacy)
  private async deriveKeyPBKDF2(
    password: string,
    salt: Uint8Array): Promise<CryptoKey> {
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
        iterations: MasterPassCrypto.PBKDF2_ITERATIONS,
        hash: "SHA-256"},
      keyMaterial,
      { name: "AES-GCM", length: MasterPassCrypto.KEY_SIZE },
      true, // Make extractable for passkey functionality
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  private async deriveKey(
    password: string,
    salt: Uint8Array,
    useArgon = true
  ): Promise<CryptoKey> {
    if (useArgon) {
        return this.deriveKeyWithArgon2id(password, salt);
    }
    return this.deriveKeyPBKDF2(password, salt);
  }

  // Getter for the master key, needed for passkey logic
  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  // Export the raw master key
  async exportKey(): Promise<ArrayBuffer | null> {
    if (!this.masterKey) return null;
    return crypto.subtle.exportKey("raw", this.masterKey);
  }

  // Import a raw key and set it as the master key
  async importKey(keyBytes: ArrayBuffer): Promise<void> {
    this.masterKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      true, // Make it extractable so it can be re-wrapped
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
    
    // Auto-unlock if we just imported a key (e.g. from SW recovery)
    if (this.masterKey) {
      this.isUnlocked = true;
      try {
        const { ecosystemSecurity } = await import('./ecosystem/security');
        await ecosystemSecurity.importMasterKey(keyBytes);
      } catch {}
    }
  }

  /**
   * Section 1: Volatile MEK Preservation (The "Session Worker")
   * Attempts to recover the MEK from the Service Worker memory.
   */
  async recoverFromServiceWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return false;
    }

    return new Promise((resolve) => {
      if (!navigator.serviceWorker.controller) {
        resolve(false);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = async (event) => {
        if (event.data.type === 'CONTEXT_RECOVERED' && event.data.payload) {
          try {
            const rawMek = event.data.payload as ArrayBuffer;
            await this.importKey(rawMek);
            await ecosystemSecurity.importMasterKey(rawMek);
            await this.unlockWithImportedKey();
            console.log('[MasterPass] Successfully recovered MEK from Service Worker.');
            resolve(true);
          } catch (err) {
            console.error('[MasterPass] Failed to import recovered MEK:', err);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };

      navigator.serviceWorker.controller.postMessage({ type: 'RECOVER_CONTEXT' }, [channel.port2]);
    });
  }

  /**
   * Syncs the current MEK to the Service Worker for reload preservation.
   */
  private async syncToServiceWorker() {
    if (!this.masterKey || typeof window === 'undefined' || !navigator.serviceWorker.controller) return;

    try {
      const rawMek = await crypto.subtle.exportKey('raw', this.masterKey);
      navigator.serviceWorker.controller.postMessage({
        type: 'STORE_CONTEXT',
        payload: rawMek
      });
    } catch (err) {
      console.warn('[MasterPass] Failed to sync MEK to Service Worker:', err);
    }
  }

  // Mark the vault as unlocked and notify ecosystem
  private markAsUnlocked(): void {
    this.isUnlocked = true;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("vault_unlocked", Date.now().toString());
      sessionStorage.setItem("kylrix_vault_unlocked", "true");
      sessionStorage.removeItem("vault_login_check");
    }
    markSudoActive();
    
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vault-unlocked"));
    }
  }

  // Unlock a key has been imported (e.g., from passkey)
  async unlockWithImportedKey(): Promise<boolean> {
    if (!this.masterKey) {
      logError("Cannot unlock with imported key: key is not present");
      return false;
    }
    try {
      const raw = await crypto.subtle.exportKey("raw", this.masterKey);
      const { ecosystemSecurity } = await import('./ecosystem/security');
      await ecosystemSecurity.importMasterKey(raw);
    } catch {}
    this.markAsUnlocked();
    await this.syncToServiceWorker();
    return true;
  }

  // Unlock vault with master password (existing vault only — use setupVault for first-time setup)
  async unlock(
    masterPassword: string,
    userId: string,
    isFirstTime: boolean = false): Promise<boolean> {
    if (isFirstTime) {
      await this.setupVault(masterPassword, userId);
      return true;
    }

    try {
      const keychainSuccess = await this.unlockWithKeychain(
        masterPassword,
        userId
      );
      if (keychainSuccess) {
        // Ensure user document is marked as having masterpass if keychain exists
        const { AppwriteService } = await import("./appwrite");
        const userDoc = await AppwriteService.getUserDoc(userId);
        if (userDoc && !userDoc.masterpass && userDoc.email) {
          await AppwriteService.setMasterpassFlag(userId, userDoc.email);
        }

        // Sync with EcosystemSecurity for identity logic
        const rawMek = await crypto.subtle.exportKey("raw", this.masterKey!);
        await ecosystemSecurity.importMasterKey(rawMek);

        // Check if we need to silently synchronize MasterPass with account password
        try {
          const { account } = await import("./appwrite/client");
          const userPrefs = await account.getPrefs().catch(() => ({})) as any;
          const masterpassForLoginEnabled = userPrefs?.masterpass_for_login_enabled !== false;

          const entry = await ecosystemSecurity.fetchKeychain(userId);
          if (entry && !entry.authPass && masterpassForLoginEnabled) {
            const { syncMasterpassToAccountPassword } = await import("./actions/client-ops");
            syncMasterpassToAccountPassword(userId, masterPassword)
              .then(() => console.log('[Vault] Silently synchronized masterpass to account password.'))
              .catch((err: any) => console.error('[Vault] Masterpass sync failed:', err));
          }
        } catch (e) {
          console.warn('[Vault] Failed to check keychain entry for authPass sync:', e);
        }

        this.markAsUnlocked();
        await this.syncToServiceWorker();
        return true;
      }

      return false;
    } catch (error: unknown) {
      if ((error as Error).message === 'VAULT_ALREADY_EXISTS') {
          throw error;
      }
      logError("Failed to unlock vault", error as Error);
      return false;
    }
  }

  /** First-time vault setup: creates encrypted keychain entry and unlocks in memory (offline-first). */
  async setupVault(masterPassword: string, userId: string): Promise<void> {
    try {
      const { SecurityEnclave } = await import('@/lib/security/enclave');
      const localEntries = (await SecurityEnclave.getKeychain(userId).catch(() => [])) || [];
      if (localEntries.some((e: any) => e.type === 'password' && !e.isPending)) {
        logError("[MasterPass] Refusing to initialize: Vault already exists for this user.");
        throw new Error("VAULT_ALREADY_EXISTS");
      }
    } catch (e: any) {
      if (e.message === 'VAULT_ALREADY_EXISTS') throw e;
    }

    this.masterKey = await this.generateRandomMEK();
    await this.createKeychainEntry(this.masterKey, masterPassword, userId);

    const rawMek = await crypto.subtle.exportKey("raw", this.masterKey!);
    await ecosystemSecurity.importMasterKey(rawMek);

    this.markAsUnlocked();
    await this.syncToServiceWorker();
  }

  // Change master password (re-wrap MEK)
  async changeMasterPassword(newPassword: string, userId: string): Promise<void> {
    if (!this.masterKey) {
      throw new Error("Vault is locked");
    }

    const rawMek = await crypto.subtle.exportKey("raw", this.masterKey);
    const freshSalt = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.SALT_SIZE));
    const freshAuthKey = await this.deriveKey(newPassword, freshSalt, true);
    const freshIv = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.IV_SIZE));
    const freshEncryptedMek = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: freshIv },
      freshAuthKey,
      rawMek
    );

    // MANDATORY ROUNDTRIP INTEGRITY CHECK
    const testDecrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: freshIv },
      freshAuthKey,
      freshEncryptedMek
    );
    if (!testDecrypted || testDecrypted.byteLength !== rawMek.byteLength) {
      throw new Error("KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation");
    }

    const freshCombined = new Uint8Array(freshIv.length + freshEncryptedMek.byteLength);
    freshCombined.set(freshIv);
    freshCombined.set(new Uint8Array(freshEncryptedMek), freshIv.length);

    const wrappedKeyBase64 = btoa(String.fromCharCode(...freshCombined));
    const saltBase64 = btoa(String.fromCharCode(...freshSalt));
    const paramsJson = JSON.stringify({
      memory: MasterPassCrypto.ARGON2_MEMORY,
      iterations: MasterPassCrypto.ARGON2_ITERATIONS,
      parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
      algo: "Argon2id"
    });

    try {
      const { upgradeKeychainToArgon } = await import("./actions/client-ops");
      const res = await upgradeKeychainToArgon({
        userId,
        wrappedKey: wrappedKeyBase64,
        salt: saltBase64,
        params: paramsJson,
      });

      if (res?.success && res.entry) {
        const { SecurityEnclave } = await import('@/lib/security/enclave');
        await SecurityEnclave.setKeychain(userId, [res.entry]);
      } else {
        await this.createKeychainEntry(this.masterKey, newPassword, userId);
      }
    } catch {
      await this.createKeychainEntry(this.masterKey, newPassword, userId);
    }

    // Trigger password sync silently if masterpass_for_login_enabled is active
    try {
      const { account } = await import("./appwrite/client");
      const userPrefs = await account.getPrefs().catch(() => ({})) as any;
      const masterpassForLoginEnabled = userPrefs?.masterpass_for_login_enabled !== false;

      if (masterpassForLoginEnabled) {
        const { syncMasterpassToAccountPassword } = await import("./actions/client-ops");
        await syncMasterpassToAccountPassword(userId, newPassword)
          .then(() => console.log('[Vault] Silently synchronized masterpass to account password on masterpass change.'))
          .catch((err: any) => console.error('[Vault] Masterpass sync failed on change:', err));
      }
    } catch (e) {
      console.warn('[Vault] Failed to trigger masterpass auth sync on change:', e);
    }
  }

  // Generate a random Master Encryption Key (MEK)
  private async generateRandomMEK(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256},
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );
  }

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
      } catch {
          return new Uint8Array(0);
      }
  }

  // Unlock using the Keychain architecture
  private async unlockWithKeychain(password: string, userId: string): Promise<boolean> {
    try {
      let keychainEntry = await ecosystemSecurity.fetchKeychain(userId);

      if (!keychainEntry) {
        return false; // No keychain entry found
      }

      // Deterministic Argon2id detection: check explicit boolean, 32-byte salt length, or JSON string/object param
      const salt = this.decodeBase64(keychainEntry.salt);
      const isArgonBySalt = salt.length === MasterPassCrypto.SALT_SIZE;
      const isArgonByParam = typeof keychainEntry.params === 'string'
        ? keychainEntry.params.includes("Argon2id")
        : (keychainEntry.params?.algo === 'Argon2id' || !!keychainEntry.params?.memory);
      
      let isArgon = Boolean(keychainEntry.isArgon || isArgonBySalt || isArgonByParam);

      logDebug(`[Vault] Unlocking with ${isArgon ? "Argon2id" : "Legacy PBKDF2"}...`);
      let authKey = await this.deriveKey(password, salt, isArgon);

      // Unwrap the MEK
      const wrappedKeyBytes = this.decodeBase64(keychainEntry.wrappedKey);

      // Extract IV (first 16 bytes)
      const iv = wrappedKeyBytes.slice(0, MasterPassCrypto.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(MasterPassCrypto.IV_SIZE);

      let decryptedMek: ArrayBuffer | null = null;
      let usedFallbackPBKDF2 = false;

      try {
        decryptedMek = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          authKey,
          ciphertext
        );
      } catch (_primaryErr) {
        // Safe fallback: If primary failed and we assumed Argon2id, test legacy PBKDF2 derivation ONCE
        if (isArgon) {
          try {
            logDebug("[Vault] Primary Argon2id unlock failed. Trying legacy PBKDF2 fallback...");
            const fallbackKey = await this.deriveKey(password, salt, false);
            decryptedMek = await crypto.subtle.decrypt(
              { name: "AES-GCM", iv: iv },
              fallbackKey,
              ciphertext
            );
            if (decryptedMek) {
              usedFallbackPBKDF2 = true;
            }
          } catch (_fallbackErr) {}
        }
      }

      // JIT Recovery: If initial local decrypt failed or was missing, attempt immediate remote sync
      if (!decryptedMek && typeof navigator !== 'undefined' && navigator.onLine !== false) {
        try {
          logDebug("[Vault] Local unwrap failed. Attempting JIT remote sync of keychain...");
          const { SecurityEnclave } = await import('@/lib/security/enclave');
          await SecurityEnclave.hydrateFromRemote(userId, { force: true });
          const { AppwriteService } = await import('./appwrite');
          const freshEntries = await AppwriteService.listKeychainEntries(userId).catch(() => []);
          const passwordEntries = freshEntries.filter((r: any) => r.type === 'password');

          for (const entry of passwordEntries) {
            if (!entry.wrappedKey || !entry.salt) continue;
            const entrySalt = this.decodeBase64(entry.salt);
            const isArgonCheck = Boolean(
              entry.isArgon ||
              (typeof entry.params === 'string' && entry.params.includes('Argon2id')) ||
              entry.params?.algo === 'Argon2id'
            );

            const candidateKeyBytes = this.decodeBase64(entry.wrappedKey);
            if (candidateKeyBytes.length <= MasterPassCrypto.IV_SIZE) continue;
            const candidateIv = candidateKeyBytes.slice(0, MasterPassCrypto.IV_SIZE);
            const candidateCiphertext = candidateKeyBytes.slice(MasterPassCrypto.IV_SIZE);

            for (const tryArgon of (isArgonCheck ? [true, false] : [false, true])) {
              try {
                const freshAuthKey = await this.deriveKey(password, entrySalt, tryArgon);
                const testMek = await crypto.subtle.decrypt(
                  { name: 'AES-GCM', iv: candidateIv },
                  freshAuthKey,
                  candidateCiphertext
                );
                if (testMek) {
                  decryptedMek = testMek;
                  keychainEntry = entry;
                  isArgon = tryArgon;
                  usedFallbackPBKDF2 = !tryArgon && isArgonCheck;
                  logDebug('[Vault] JIT recovery unwrap succeeded.');
                  break;
                }
              } catch {}
            }
            if (decryptedMek) break;
          }
        } catch (recoveryErr) {
          logDebug('[Vault] Recovery sync failed:', { error: String(recoveryErr) });
        }
      }

      if (!decryptedMek) return false;

      // Import the verified MEK
      this.masterKey = await crypto.subtle.importKey(
        "raw",
        decryptedMek,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );

      // Cleanse stale boolean and update Enclave state
      try {
        const { SecurityEnclave } = await import('@/lib/security/enclave');
        await SecurityEnclave.touchMeta(userId, {
          hasMasterpass: true,
          keychainCount: Math.max(1, (await SecurityEnclave.getKeychain(userId)).length),
        });
      } catch {}

      // --- SEAMLESS MIGRATION: Trigger ONLY after confirmed PBKDF2 unlock ---
      if (!isArgon || usedFallbackPBKDF2) {
          logDebug("[Migration] Confirmed legacy PBKDF2 unlock. Initializing Double-Lock upgrade...");
          this.onMigrationStart?.();
          
          // Failsafe: Store encrypted RAM backup
          const backupId = `kylrix_mek_backup_${userId}`;
          const rawMek = await crypto.subtle.exportKey("raw", this.masterKey!);
          const backupSecret = crypto.getRandomValues(new Uint8Array(32));
          
          try {
              // Encrypt backup for sessionStorage
              const backupIv = crypto.getRandomValues(new Uint8Array(16));
              const backupKey = await crypto.subtle.importKey("raw", backupSecret, { name: "AES-GCM" }, false, ["encrypt"]);
              const encryptedBackup = await crypto.subtle.encrypt({ name: "AES-GCM", iv: backupIv }, backupKey, rawMek);
              const combinedBackup = new Uint8Array(backupIv.length + encryptedBackup.byteLength);
              combinedBackup.set(backupIv);
              combinedBackup.set(new Uint8Array(encryptedBackup), backupIv.length);
              
              sessionStorage.setItem(backupId, btoa(String.fromCharCode(...combinedBackup)));
              
              // Derive fresh Argon2id key and wrap MEK
              const freshSalt = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.SALT_SIZE));
              const freshAuthKey = await this.deriveKey(password, freshSalt, true);
              const freshIv = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.IV_SIZE));
              const freshEncryptedMek = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: freshIv },
                freshAuthKey,
                rawMek
              );

              // MANDATORY ROUNDTRIP INTEGRITY CHECK
              const testDecrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: freshIv },
                freshAuthKey,
                freshEncryptedMek
              );
              if (!testDecrypted || testDecrypted.byteLength !== rawMek.byteLength) {
                throw new Error("KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation");
              }

              const freshCombined = new Uint8Array(freshIv.length + freshEncryptedMek.byteLength);
              freshCombined.set(freshIv);
              freshCombined.set(new Uint8Array(freshEncryptedMek), freshIv.length);

              const wrappedKeyBase64 = btoa(String.fromCharCode(...freshCombined));
              const saltBase64 = btoa(String.fromCharCode(...freshSalt));
              const paramsJson = JSON.stringify({
                memory: MasterPassCrypto.ARGON2_MEMORY,
                iterations: MasterPassCrypto.ARGON2_ITERATIONS,
                parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
                algo: "Argon2id"
              });

              // Execute atomic multi-table transaction
              const { upgradeKeychainToArgon } = await import("./actions/client-ops");
              const res = await upgradeKeychainToArgon({
                userId,
                wrappedKey: wrappedKeyBase64,
                salt: saltBase64,
                params: paramsJson,
              });

              if (res?.success && res.entry) {
                const { SecurityEnclave } = await import('@/lib/security/enclave');
                await SecurityEnclave.setKeychain(userId, [res.entry]);
              }

              logDebug("[Migration] Successfully upgraded to Argon2id via atomic transaction.");
              sessionStorage.removeItem(backupId); // Purge backup immediately
              this.onMigrationEnd?.(true);
          } catch (err) {
              logError("[Migration] Failure during Double-Lock upgrade. Existing row preserved.", err as Error);
              this.onMigrationEnd?.(false);
          }
      }

      return true;
    } catch (error: unknown) {
      logError("Error in unlockWithKeychain", error as Error);
      return false;
    }
  }

  // Create a new keychain entry (wraps the MEK with the password)
}
