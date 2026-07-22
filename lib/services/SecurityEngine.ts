'use client';

/**
 * SecurityEngine — Encryption/Decryption, Keychain Local Storage, & MasterPass/Passkey Engine.
 * Stores user keychain rows encrypted-as-is in LocalEngine for instant 0ms offline unlock.
 * Subscribes to SpineEngine over-clock ticks during masterpass drawer observation mode.
 */

import { SpineEngine } from '@/lib/services/SpineEngine';
import { LocalEngine } from '@/lib/services/LocalEngine';

export interface KeychainEntry {
  $id: string;
  userId: string;
  type: 'password' | 'passkey' | 'totp' | 'keychain';
  salt?: string;
  wrappedKey?: string;
  params?: any;
  isArgon?: boolean;
  createdAt?: string;
}

class SecurityEngineService {
  private masterKeyMemory: Uint8Array | null = null;
  private isUnlocked = false;

  /** Hydrate local keychain rows from LocalEngine (0ms offline unlock) */
  public async getLocalKeychain(userId: string): Promise<KeychainEntry[]> {
    if (!userId) return [];
    const cacheKey = `f_keychain_${userId}`;
    const cached = await LocalEngine.cacheGet<KeychainEntry[]>(cacheKey);
    return cached || [];
  }

  /** Cache user keychain rows encrypted-as-is into LocalEngine */
  public async saveLocalKeychain(userId: string, entries: KeychainEntry[]): Promise<void> {
    if (!userId || !entries) return;
    const cacheKey = `f_keychain_${userId}`;
    await LocalEngine.cacheSet(cacheKey, entries);
  }

  /** Initialize high-frequency SpineEngine observation mode during masterpass drawer activity */
  public enterObservationMode(activeResourceId: string = 'masterpass_lock') {
    SpineEngine.setFocusedResource(activeResourceId, 50); // Over-clock to 50ms pulse
  }

  /** Exit observation mode */
  public exitObservationMode() {
    SpineEngine.setFocusedResource(null);
  }

  /** In-Memory Master Encryption Key (MEK) Management */
  public setMasterKeyInMemory(key: Uint8Array) {
    this.masterKeyMemory = key;
    this.isUnlocked = true;
  }

  public getMasterKeyInMemory(): Uint8Array | null {
    return this.masterKeyMemory;
  }

  public isVaultUnlocked(): boolean {
    return this.isUnlocked && this.masterKeyMemory !== null;
  }

  public lockVault() {
    if (this.masterKeyMemory) {
      this.masterKeyMemory.fill(0);
    }
    this.masterKeyMemory = null;
    this.isUnlocked = false;
    this.exitObservationMode();
  }
}

export const SecurityEngine = new SecurityEngineService();
