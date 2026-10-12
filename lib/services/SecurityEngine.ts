'use client';

/**
 * SecurityEngine — in-memory MEK + Spine observation.
 * Keychain persistence is owned by SecurityEnclave (LocalEngine).
 */

import { SpineEngine } from '@/lib/services/SpineEngine';
import { SecurityEnclave } from '@/lib/security/enclave';

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

  public async getLocalKeychain(userId: string): Promise<KeychainEntry[]> {
    if (!userId) return [];
    return SecurityEnclave.getKeychain(userId);
  }

  public async saveLocalKeychain(userId: string, entries: KeychainEntry[]): Promise<void> {
    if (!userId || !entries) return;
    await SecurityEnclave.setKeychain(userId, entries);
  }

  public enterObservationMode(activeResourceId: string = 'masterpass_lock') {
    SpineEngine.setFocusedResource(activeResourceId, 50);
  }

  public exitObservationMode() {
    SpineEngine.setFocusedResource(null);
  }

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
