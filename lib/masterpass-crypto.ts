import { logDebug, logError } from '@/lib/logger';
import { markSudoActive, resetSudo } from '@/lib/sudo-mode';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

// Enhanced crypto configuration for maximum security with optimal performance
export class MasterPassCrypto {
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
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    const { argon2id } = await import('hash-wasm');
    const hash = await argon2id({
      password,
      salt,
      parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
      iterations: MasterPassCrypto.ARGON2_ITERATIONS,
      memorySize: MasterPassCrypto.ARGON2_MEMORY,
      hashLength: 32, // 256 bits
      outputType: 'binary',
    });

    return crypto.subtle.importKey(
      "raw",
      hash as any,
      { name: "AES-GCM", length: MasterPassCrypto.KEY_SIZE },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
  }

  // Derive key from master password using PBKDF2 (Legacy)
  private async deriveKeyPBKDF2(
    password: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
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
        iterations: MasterPassCrypto.PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: MasterPassCrypto.KEY_SIZE },
      true, // Make extractable for passkey functionality
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
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
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
    
    // Auto-unlock if we just imported a key (e.g. from SW recovery)
    if (this.masterKey) {
        this.isUnlocked = true;
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

  // Unlock a key has been imported (e.g., from passkey)
  async unlockWithImportedKey(): Promise<boolean> {
    if (!this.masterKey) {
      logError("Cannot unlock with imported key: key is not present");
      return false;
    }
    this.isUnlocked = true;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("vault_unlocked", Date.now().toString());
      // CRITICAL FIX: Ensure ecosystem sync is reflected in sessionStorage immediately
      // EcosystemSecurity uses this key to track unlock status across apps.
      sessionStorage.setItem("kylrix_vault_unlocked", "true");
    }
    markSudoActive();
    return true;
  }

  // Unlock vault with master password
  async unlock(
    masterPassword: string,
    userId: string,
    isFirstTime: boolean = false,
  ): Promise<boolean> {
    try {
      // 1. Try to unlock via Keychain (New Architecture)
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

        this.isUnlocked = true;
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("vault_unlocked", Date.now().toString());
          // Ensure we don't have stale login data
          sessionStorage.removeItem("vault_login_check");
          
          // CRITICAL FIX: Ensure ecosystem sync is reflected in sessionStorage immediately
          // EcosystemSecurity uses this key to track unlock status across apps.
          sessionStorage.setItem("kylrix_vault_unlocked", "true");
        }
        markSudoActive();
        await this.syncToServiceWorker();
        return true;
      }

      // 2. If first time setup, create new keychain entry
      if (isFirstTime) {
          // CRITICAL GUARD: Ensure we don't overwrite an existing vault
          const { AppwriteService } = await import("./appwrite");
          const existingEntries = await AppwriteService.listKeychainEntries(userId);
          const hasExisting = existingEntries.some((e: any) => e.type === 'password');
          
          if (hasExisting) {
              logError("[MasterPass] Refusing to initialize: Vault already exists for this user.");
              // Throw specific error that UI can catch
              throw new Error("VAULT_ALREADY_EXISTS");
          }

        // Generate a random MEK for new users
        this.masterKey = await this.generateRandomMEK();

        // Create keychain entry immediately
        await this.createKeychainEntry(this.masterKey, masterPassword, userId);

        // Sync with EcosystemSecurity for identity logic
        const rawMek = await crypto.subtle.exportKey("raw", this.masterKey!);
        await ecosystemSecurity.importMasterKey(rawMek);

        this.isUnlocked = true;
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("vault_unlocked", Date.now().toString());
          // CRITICAL FIX: Ensure ecosystem sync is reflected in sessionStorage immediately
          // EcosystemSecurity uses this key to track unlock status across apps.
          sessionStorage.setItem("kylrix_vault_unlocked", "true");
        }
        markSudoActive();
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

  // Change master password (re-wrap MEK)
  async changeMasterPassword(newPassword: string, userId: string): Promise<void> {
    if (!this.masterKey) {
      throw new Error("Vault is locked");
    }

    // Re-wrap MEK with new password
    await this.createKeychainEntry(this.masterKey, newPassword, userId);
  }

  // Generate a random Master Encryption Key (MEK)
  private async generateRandomMEK(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
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
      const keychainEntry = await ecosystemSecurity.fetchKeychain(userId);

      if (!keychainEntry) {
        return false; // No keychain entry found
      }

      const isArgon = !!keychainEntry.isArgon || (keychainEntry.params && keychainEntry.params.includes("Argon2id"));

      // Derive AuthKey using the stored salt
      const salt = this.decodeBase64(keychainEntry.salt);

      logDebug(`[Vault] Unlocking with ${isArgon ? "Argon2id" : "Legacy PBKDF2"}...`);
      const authKey = await this.deriveKey(password, salt, isArgon);

      // Unwrap the MEK
      const wrappedKeyBytes = this.decodeBase64(keychainEntry.wrappedKey);

      // Extract IV (first 16 bytes)
      const iv = wrappedKeyBytes.slice(0, MasterPassCrypto.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(MasterPassCrypto.IV_SIZE);


      try {
        const mekBytes = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          authKey,
          ciphertext
        );

        // Import the MEK
        this.masterKey = await crypto.subtle.importKey(
          "raw",
          mekBytes,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
        );

        // --- SEAMLESS MIGRATION: PBKDF2 -> Argon2id (Double-Lock Pattern) ---
        if (!isArgon) {
            logDebug("[Migration] Legacy PBKDF2 detected. Initializing Double-Lock upgrade...");
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
                
                // 1. Write new elite entry (marked as PENDING)
                const { AppwriteService } = await import("./appwrite");
                const newEntry = await this.createKeychainEntry(this.masterKey, password, userId, true, true);
                
                // 2. Delete legacy entry
                if (keychainEntry.$id) {
                    await AppwriteService.deleteKeychainEntry(keychainEntry.$id);
                }

                // 3. Finalize new entry (remove PENDING status)
                await AppwriteService.updateKeychainEntry(newEntry.$id, { isPending: false });

                logDebug("[Migration] Successfully upgraded to Argon2id via Double-Lock.");
                sessionStorage.removeItem(backupId); // Purge backup immediately
                this.onMigrationEnd?.(true);
            } catch (err) {
                logError("[Migration] Critical failure during Double-Lock upgrade", err as Error);
                this.onMigrationEnd?.(false);
            }
        }

        return true;
      } catch (e: unknown) {
        logDebug("Failed to unwrap key with provided password", { error: e });
        return false;
      }
    } catch (error: unknown) {
      logError("Error in unlockWithKeychain", error as Error);
      return false;
    }
  }

  // Create a new keychain entry (wraps the MEK with the password)
  private async createKeychainEntry(mek: CryptoKey, password: string, userId: string, useArgon = true, isPending = false): Promise<any> {
    try {
      const { AppwriteService } = await import("./appwrite");

      // Generate new random salt for the AuthKey
      const salt = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.SALT_SIZE));
      const authKey = await this.deriveKey(password, salt, useArgon);

      // Export MEK to raw bytes
      const mekBytes = await crypto.subtle.exportKey("raw", mek);

      // Encrypt (Wrap) the MEK with AuthKey
      const iv = crypto.getRandomValues(new Uint8Array(MasterPassCrypto.IV_SIZE));
      const encryptedMek = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        authKey,
        mekBytes
      );

      // Combine IV + Encrypted MEK
      const combined = new Uint8Array(iv.length + encryptedMek.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedMek), iv.length);

      const wrappedKeyBase64 = btoa(String.fromCharCode(...combined));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      // CRITICAL: Clean up existing entries to prevent metadata bloat
      const existing = await AppwriteService.listKeychainEntries(userId);
      const passwordEntries = existing.filter((k: any) => k.type === 'password');
      
      // If we are creating a PENDING entry, delete any existing PENDING ones first
      if (isPending) {
          const pendingEntries = passwordEntries.filter((e: any) => e.isPending);
          for (const pe of pendingEntries) {
              await AppwriteService.deleteKeychainEntry(pe.$id);
          }
      } else {
          // If we are creating a STABLE entry (finalizing), delete the legacy row
          const stableEntries = passwordEntries.filter((e: any) => !e.isPending);
          for (const se of stableEntries) {
              await AppwriteService.deleteKeychainEntry(se.$id);
          }
      }

      return await AppwriteService.createKeychainEntry({
        userId,
        type: 'password',
        credentialId: null,
        wrappedKey: wrappedKeyBase64,
        salt: saltBase64,
        isArgon: useArgon,
        isPending: isPending,
        params: JSON.stringify(useArgon ? {
          memory: MasterPassCrypto.ARGON2_MEMORY,
          iterations: MasterPassCrypto.ARGON2_ITERATIONS,
          parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
          algo: "Argon2id"
        } : {
          iterations: MasterPassCrypto.PBKDF2_ITERATIONS,
          algo: "SHA-256"
        }),
        isBackup: false
      });

    } catch (error: unknown) {
      logError("Failed to create keychain entry", error as Error);
      throw error;
    }
  }

  // Lock vault (clear master key from memory)
  lock(): void {
    this.masterKey = null;
    this.isUnlocked = false;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("vault_unlocked");
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }
    resetSudo();
  }

  // Reset master password (clear vault and force new setup)
  async resetMasterPassword(): Promise<boolean> {
    try {
      this.lockApplication();

      // Trigger server-side purge of Tier 2 data
      const { executeMasterPurgeSecure } = await import('@/lib/actions/secure-ops');
      const result = await executeMasterPurgeSecure();
      if (!result.success) {
        logError("Failed to trigger server-side purge during reset");
        return false;
      }

      // Clear any setup flags
      if (typeof window !== "undefined") {
        const userId = sessionStorage.getItem("current_user_id");
        if (userId) {
          localStorage.removeItem(`masterpass_setup_${userId}`);
        }
      }

      logDebug("Master password reset and data purge successful");
      return true;
    } catch (error: unknown) {
      logError("Critical failure during master password reset", error as Error);
      return false;
    }
  }

  // Get timeout setting from localStorage or use default
  private getTimeoutSetting(): number {
    if (typeof localStorage === "undefined") return MasterPassCrypto.DEFAULT_TIMEOUT;
    const saved = localStorage.getItem("vault_timeout_minutes");
    return saved
      ? parseInt(saved) * 60 * 1000
      : MasterPassCrypto.DEFAULT_TIMEOUT;
  }

  // Set timeout setting
  static setTimeoutMinutes(minutes: number): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("vault_timeout_minutes", minutes.toString());
    }
  }

  // Get timeout in minutes for UI
  static getTimeoutMinutes(): number {
    if (typeof localStorage === "undefined") return 10;
    const saved = localStorage.getItem("vault_timeout_minutes");
    return saved ? parseInt(saved) : 10; // default 10 minutes
  }

  // Check if vault is unlocked with dynamic timeout
  isVaultUnlocked(): boolean {
    if (this.isUnlocked && !!this.masterKey) {
      // If memory is unlocked, verify timeout
      if (typeof sessionStorage !== "undefined") {
        const unlockTime = sessionStorage.getItem("vault_unlocked");
        if (unlockTime) {
          const elapsed = Date.now() - parseInt(unlockTime);
          const timeout = this.getTimeoutSetting();
          if (elapsed > timeout) {
            logDebug("Vault timeout reached", { elapsed, timeout });
            this.lockApplication();
            return false;
          }
        }
      }
      return true;
    }

    return false;
  }

  // Encrypt data before sending to database
  async encryptData(data: unknown): Promise<string> {
    logDebug("encryptData called", {
      isVaultUnlocked: this.isVaultUnlocked(),
      hasMasterKey: !!this.masterKey,
      isUnlockedFlag: this.isUnlocked
    });

    if (!this.isVaultUnlocked()) {
      throw new Error("Vault is locked - cannot encrypt data");
    }

    // Validate input data
    if (data === null || data === undefined) {
      throw new Error("Cannot encrypt null or undefined data");
    }

    // Convert to string if not already
    const dataToEncrypt = typeof data === "string" ? data : String(data);

    if (dataToEncrypt.trim().length === 0) {
      throw new Error("Cannot encrypt empty string");
    }

    try {
      const encoder = new TextEncoder();
      const plaintext = encoder.encode(JSON.stringify(dataToEncrypt));

      // Generate larger IV for enhanced security
      const iv = crypto.getRandomValues(
        new Uint8Array(MasterPassCrypto.IV_SIZE),
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.masterKey!,
        plaintext,
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Return base64 encoded string
      const result = btoa(String.fromCharCode(...combined));
      logDebug("Encryption successful", { resultLength: result.length });
      return result;
    } catch (error: unknown) {
      logError("Encryption failed", error as Error);
      throw new Error("Failed to encrypt data: " + error);
    }
  }

  // Decrypt data received from database
  async decryptData(encryptedData: string): Promise<unknown> {
    if (!this.isVaultUnlocked()) {
      throw new Error("Vault is locked");
    }

    // Validate input
    if (!encryptedData || typeof encryptedData !== "string") {
      throw new Error("Invalid encrypted data provided");
    }

    if (encryptedData.trim().length === 0) {
      throw new Error("Cannot decrypt empty string");
    }

    try {
      // Decode base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((char) => char.charCodeAt(0)),
      );

      // Extract IV (now 16 bytes) and encrypted data
      const iv = combined.slice(0, MasterPassCrypto.IV_SIZE);
      const encrypted = combined.slice(MasterPassCrypto.IV_SIZE);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.masterKey!,
        encrypted,
      );

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decrypted);
      return JSON.parse(plaintext);
    } catch (error: unknown) {
      logError("Decryption failed", error as Error);
      throw new Error("Failed to decrypt data");
    }
  }

  // Application lock functionality
  lockApplication(): void {
    // Clear all decrypted data from memory
    this.masterKey = null;
    this.isUnlocked = false;
    resetSudo();

    // Wipe from Service Worker
    if (typeof window !== 'undefined' && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'WIPE_CONTEXT' });
    }

    // Clear session storage
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("vault_unlocked");
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }

    // Clear any cached decrypted data
    this.clearDecryptedCache();

    // Force garbage collection if available
    if (typeof window !== "undefined" && "gc" in window) {
      (window as Window & { gc?: () => void }).gc?.();
    }
  }

  // Clear any cached decrypted data from components
  private clearDecryptedCache(): void {
    // Dispatch custom event to notify components to clear their decrypted data
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vault-locked"));
    }
  }

  // Update activity timestamp
  updateActivity(): void {
    if (this.isUnlocked) {
      // Throttle updates to once per second to avoid rapid event bursts
      if (typeof sessionStorage !== "undefined") {
        const last = sessionStorage.getItem("vault_unlocked");
        const now = Date.now();
        if (!last || now - parseInt(last) >= 1000) {
          sessionStorage.setItem("vault_unlocked", now.toString());
        }
      }
    }
  }

  // Explicit lock trigger for UI actions
  lockNow(): void {
    this.lockApplication();
  }
}

export const masterPassCrypto = MasterPassCrypto.getInstance();

// Export utility functions for settings page
export const setVaultTimeout = (minutes: number) => {
  MasterPassCrypto.setTimeoutMinutes(minutes);
};

export const getVaultTimeout = () => {
  return MasterPassCrypto.getTimeoutMinutes();
};

// Utility functions for field-specific encryption with validation
export const encryptField = async (value: string): Promise<string> => {
  // Validate input before encryption
  if (value === null || value === undefined) {
    throw new Error("Cannot encrypt null or undefined value");
  }

  if (typeof value !== "string") {
    throw new Error("Can only encrypt string values");
  }

  if (value.trim().length === 0) {
    throw new Error("Cannot encrypt empty string");
  }

  return masterPassCrypto.encryptData(value);
};

export const decryptField = async (encryptedValue: string): Promise<string> => {
  // Validate input before decryption
  if (!encryptedValue || typeof encryptedValue !== "string") {
    throw new Error("Invalid encrypted value provided");
  }

  if (encryptedValue.trim().length === 0) {
    throw new Error("Cannot decrypt empty string");
  }

  return masterPassCrypto.decryptData(encryptedValue) as Promise<string>;
};

// Add utility function for reset
export const resetMasterPasswordVault = () => {
  masterPassCrypto.resetMasterPassword();
};
