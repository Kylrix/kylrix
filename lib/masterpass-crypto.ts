import { logDebug, logError } from '@/lib/logger';
import { markSudoActive, resetSudo } from '@/lib/sudo-mode';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

// Enhanced crypto configuration for maximum security with optimal performance
import { MasterPassCryptoBase } from './masterpass-crypto-base';

export class MasterPassCrypto extends MasterPassCryptoBase {
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

      // MANDATORY ROUNDTRIP INTEGRITY CHECK
      const testDecrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        authKey,
        encryptedMek
      );
      if (!testDecrypted || testDecrypted.byteLength !== mekBytes.byteLength) {
        throw new Error("KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation");
      }

      // Combine IV + Encrypted MEK
      const combined = new Uint8Array(iv.length + encryptedMek.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedMek), iv.length);

      const wrappedKeyBase64 = btoa(String.fromCharCode(...combined));
      const saltBase64 = btoa(String.fromCharCode(...salt));
      const paramsJson = JSON.stringify(useArgon ? {
        memory: MasterPassCrypto.ARGON2_MEMORY,
        iterations: MasterPassCrypto.ARGON2_ITERATIONS,
        parallelism: MasterPassCrypto.ARGON2_PARALLELISM,
        algo: "Argon2id"
      } : {
        iterations: MasterPassCrypto.PBKDF2_ITERATIONS,
        algo: "SHA-256"
      });

      const localEntry = {
        $id: `keychain_${userId}_password`,
        id: `keychain_${userId}_password`,
        userId,
        type: 'password',
        credentialId: null,
        wrappedKey: wrappedKeyBase64,
        salt: saltBase64,
        isArgon: useArgon,
        isPending: isPending,
        params: paramsJson,
        isBackup: false,
        authPass: false,
        $createdAt: new Date().toISOString(),
      };

      // Instantly persist in local SecurityEnclave & LocalEngine
      try {
        const { SecurityEnclave } = await import('@/lib/security/enclave');
        await SecurityEnclave.setKeychain(userId, [localEntry]);
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        await LocalEngine.cacheSet(`f_keychain_${userId}`, [localEntry]);
      } catch {}

      // Opportunistic background sync to Appwrite
      try {
        const existing = await AppwriteService.listKeychainEntries(userId).catch(() => []);
        const passwordEntries = existing.filter((k: any) => k.type === 'password');
        
        if (isPending) {
          const pendingEntries = passwordEntries.filter((e: any) => e.isPending);
          for (const pe of pendingEntries) {
            await AppwriteService.deleteKeychainEntry(pe.$id).catch(() => {});
          }
        } else {
          const stableEntries = passwordEntries.filter((e: any) => !e.isPending);
          for (const se of stableEntries) {
            await AppwriteService.deleteKeychainEntry(se.$id).catch(() => {});
          }
        }

        const remote = await AppwriteService.createKeychainEntry({
          userId,
          type: 'password',
          credentialId: null,
          wrappedKey: wrappedKeyBase64,
          salt: saltBase64,
          isArgon: useArgon,
          isPending: isPending,
          params: paramsJson,
          isBackup: false,
          authPass: false
        }).catch(() => null);

        if (remote) {
          try {
            const { SecurityEnclave } = await import('@/lib/security/enclave');
            await SecurityEnclave.setKeychain(userId, [remote]);
          } catch {}
          return remote;
        }
      } catch {
        // Offline or backend unavailable — local entry remains valid
      }

      return localEntry;

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
    // Dynamic sync with ecosystemSecurity to prevent locked/unlocked divergence
    if (!ecosystemSecurity.status.isUnlocked) {
      if (this.isUnlocked) {
        this.lockApplication();
      }
      return false;
    }

    if (!this.isUnlocked || !this.masterKey) {
      const ecoKey = ecosystemSecurity.getMasterKey();
      if (ecoKey) {
        this.masterKey = ecoKey;
        this.isUnlocked = true;
        if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem("vault_unlocked")) {
          sessionStorage.setItem("vault_unlocked", Date.now().toString());
          sessionStorage.setItem("kylrix_vault_unlocked", "true");
        }
      }
    }

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
        new Uint8Array(MasterPassCrypto.IV_SIZE));

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.masterKey!,
        plaintext);

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
          .map((char: any) => char.charCodeAt(0)));

      // Extract IV (now 16 bytes) and encrypted data
      const iv = combined.slice(0, MasterPassCrypto.IV_SIZE);
      const encrypted = combined.slice(MasterPassCrypto.IV_SIZE);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.masterKey!,
        encrypted);

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decrypted);
      return JSON.parse(plaintext);
    } catch (error: unknown) {
      logError("Decryption failed", error as Error);
      throw new Error("Failed to decrypt data");
    }
  }

  // Decrypt data with dynamic workspace MEK resolution (Agentic Workspace support)
  async decryptDataForWorkspace(
    encryptedData: string,
    workspace?: { isAgentic?: boolean; agentId?: string | null } | null,
    wrappedDek?: string | null
  ): Promise<unknown> {
    if (workspace?.isAgentic && workspace?.agentId) {
      try {
        const text = await ecosystemSecurity.decryptWithWorkspace(encryptedData, workspace, wrappedDek);
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      } catch (err) {
        logError("Agentic workspace decryption failed, attempting standard fallback:", err as Error);
      }
    }
    return this.decryptData(encryptedData);
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

  async isMigrationInterrupted(userId: string): Promise<boolean> {
    try {
      const { AppwriteService } = await import("./appwrite");
      const entries = await AppwriteService.listKeychainEntries(userId);
      const passwordEntries = entries.filter((e: any) => e.type === "password");
      return passwordEntries.some((e: any) => e.isPending);
    } catch (err) {
      logError("Failed to check vault migration status", err as Error);
      return false;
    }
  }
}


export const masterPassCrypto = MasterPassCrypto.getInstance();

// Export utility functions for settings page


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

export function looksEncrypted(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const v = val.trim();
  if (
    v.startsWith('aes-gcm:') ||
    v.startsWith('{"iv"') ||
    v.startsWith('{"ct"') ||
    v.includes('::') ||
    v.startsWith('[DECRYPTION_')
  ) {
    return true;
  }
  
  // MasterPass / AES-GCM base64 format check:
  // Must be valid base64, length >= 44 (16-byte IV + 16-byte tag + ciphertext in base64),
  // and contain standard padding or base64 structure without common plaintext whitespace/punctuation.
  if (v.length >= 44 && /^[A-Za-z0-9+/]+={0,2}$/.test(v)) {
    try {
      const decoded = atob(v);
      // Minimum AES-GCM envelope is 16 bytes IV + 16 bytes tag = 32 bytes binary
      if (decoded.length >= 32) {
        // If decoding produces binary non-printable control bytes in the first 16 bytes (IV), it's ciphertext
        let nonPrintable = 0;
        for (let i = 0; i < Math.min(decoded.length, 16); i++) {
          const code = decoded.charCodeAt(i);
          if (code < 32 || code > 126) nonPrintable++;
        }
        if (nonPrintable >= 2) return true;
      }
    } catch {
      return false;
    }
  }
  
  return false;
}

// Add utility function for reset
