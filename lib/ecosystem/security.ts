/**
 * Kylrix Ecosystem Security Protocol (WESP)
 * Centralized security and encryption logic for the entire ecosystem.
 * Hosted by the ID node (Identity Management System).
 */

import { MeshProtocol } from './mesh';
import { AppwriteService } from '@/lib/appwrite';

export class EcosystemSecurity {
  private static instance: EcosystemSecurity;
  private masterKey: CryptoKey | null = null;
  private isUnlocked = false;
  private nodeId: string = 'id';
  // SECURITY: Tab-specific secret (RAM-only) to protect against XSS (CVE-KYL-2026-005)
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
    MeshProtocol.subscribe((msg) => {
      if (msg.type === 'COMMAND' && msg.payload.action === 'LOCK_SYSTEM') {
        this.lock();
      }
    });
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
    if (!this.masterKey) throw new Error("Security vault locked");
    
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
    if (!this.masterKey) throw new Error("Security vault locked");

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
    return JSON.parse(decoder.decode(decrypted));
  }

  async saveRecoveryIdentity(
    userId: string,
    recoveryCodes: string[],
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (!this.masterKey) {
      throw new Error("Security vault locked");
    }

    const encryptedPayload = await this.encrypt(JSON.stringify({
      kind: 'recovery',
      recoveryCodes,
      savedAt: new Date().toISOString(),
      ...metadata,
    }));

    await AppwriteService.upsertRecoveryIdentity({
      userId,
      encryptedBlob: encryptedPayload,
      metadata: {
        ...metadata,
        codeCount: recoveryCodes.length,
      },
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

  /**
   * Ensure E2E identity is synced
   */
  async ensureE2EIdentity(userId: string) {
    console.log(`[EcosystemSecurity] Ensuring E2E identity for ${userId}`);
    // implementation placeholder
    return true;
  }

  lock() {
    this.masterKey = null;
    this.isUnlocked = false;
    if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("kylrix_vault_unlocked");
        // We DO NOT remove kylrix_ephemeral_session here, 
        // as the PIN is meant to unlock the system when it's locked.
        // It should only be purged on "Purge" (tab close/process exit).
    }
  }

  get status() {
    return {
      isUnlocked: this.isUnlocked,
      hasKey: !!this.masterKey
    };
  }
}

export const ecosystemSecurity = EcosystemSecurity.getInstance();
