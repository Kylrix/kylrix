import { ecosystemSecurity } from "@/lib/ecosystem/security";

// Enhanced crypto configuration for maximum security with optimal performance
export class MasterPassCrypto {
  private static instance: MasterPassCrypto;
  private masterKey: CryptoKey | null = null;
  private isUnlocked = false;

  static getInstance(): MasterPassCrypto {
    if (!MasterPassCrypto.instance) {
      MasterPassCrypto.instance = new MasterPassCrypto();
    }
    return MasterPassCrypto.instance;
  }

  // Enhanced configuration constants
  private static readonly PBKDF2_ITERATIONS = 600000;
  private static readonly SALT_SIZE = 32;
  private static readonly IV_SIZE = 16;
  private static readonly KEY_SIZE = 256;

  // Derive key from master password using PBKDF2
  private async deriveKey(
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
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
  }

  // Import a raw key and set it as the master key
  async importKey(keyBytes: ArrayBuffer): Promise<void> {
    this.masterKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    );
  }

  // Unlock when a key has been imported
  async unlockWithImportedKey(): Promise<boolean> {
    if (!this.masterKey) return false;
    this.isUnlocked = true;
    
    // Sync with EcosystemSecurity
    const rawMek = await crypto.subtle.exportKey("raw", this.masterKey);
    await ecosystemSecurity.importMasterKey(rawMek);

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("kylrix_vault_unlocked", "true");
    }
    return true;
  }

  // Unlock session with master password
  async unlock(password: string, userId: string): Promise<boolean> {
    try {
      const { AppwriteService } = await import("@/lib/appwrite");
      const entries = await AppwriteService.listKeychainEntries(userId);
      const passwordEntry = entries.find(k => k.type === 'password');

      if (!passwordEntry) return false;

      const salt = new Uint8Array(
        atob(passwordEntry.salt).split("").map(c => c.charCodeAt(0))
      );

      const authKey = await this.deriveKey(password, salt);
      const wrappedKeyBytes = new Uint8Array(
        atob(passwordEntry.wrappedKey).split("").map(c => c.charCodeAt(0))
      );

      const iv = wrappedKeyBytes.slice(0, MasterPassCrypto.IV_SIZE);
      const ciphertext = wrappedKeyBytes.slice(MasterPassCrypto.IV_SIZE);

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

      await this.unlockWithImportedKey();
      return true;
    } catch (e: unknown) {
      console.error("Unlock failed", e);
      return false;
    }
  }

  lock(): void {
    this.masterKey = null;
    this.isUnlocked = false;
    ecosystemSecurity.lock();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("kylrix_vault_unlocked");
    }
  }
}

export const masterPassCrypto = MasterPassCrypto.getInstance();
