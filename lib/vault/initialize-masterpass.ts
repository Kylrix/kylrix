'use client';

import { KeychainService } from '@/lib/appwrite/keychain';
import { setMasterpassFlag } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { masterPassCrypto } from '@/lib/masterpass-crypto';

export type InitializeMasterPassVaultInput = {
  userId: string;
  email: string;
  masterPassword: string;
  name?: string;
};

export type EnsureMasterPassVaultResult = 'initialized' | 'unlocked';

async function userHasPasswordKeychain(userId: string): Promise<boolean> {
  try {
    const { SecurityEnclave } = await import('@/lib/security/enclave');
    await SecurityEnclave.hydrateFromRemote(userId, { force: true }).catch(() => {});
  } catch {
    // Non-blocking — fall through to keychain probe
  }

  const entries = await KeychainService.listKeychainEntries(userId);
  return entries.some((entry) => entry.type === 'password');
}

/**
 * Canonical first-time vault setup used by signup, sign-in, and Settings.
 * Creates the keychain, marks masterpass configured, and links authPass for login.
 */
export async function initializeMasterPassVault(
  input: InitializeMasterPassVaultInput
): Promise<void> {
  const { userId, email, masterPassword } = input;
  const displayName = (input.name || '').trim() || email.split('@')[0];

  await masterPassCrypto.setupVault(masterPassword, userId);

  await setMasterpassFlag(userId, email);

  const { syncMasterpassToAccountPasswordAction } = await import('@/lib/actions/secure-ops/misc');
  await syncMasterpassToAccountPasswordAction({ userId, masterpass: masterPassword });

  try {
    await ecosystemSecurity.ensureE2EIdentity(userId);
  } catch (err) {
    console.warn('[Vault] Non-blocking identity sync failure:', err);
  }

  try {
    const pubKey = await ecosystemSecurity.syncIdentity(userId).catch(() => null);
    const { UsersService } = await import('@/lib/services/users');
    const profile = await UsersService.ensureProfileForUser({
      $id: userId,
      email,
      name: displayName,
    });
    if (pubKey && profile) {
      await UsersService.updateProfile(userId, { publicKey: pubKey });
    }
  } catch (err) {
    console.warn('[Vault] Non-blocking profile setup failure:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:masterpass-updated'));
  }
}

/**
 * After a successful Appwrite password session, ensure vault is configured.
 * Initializes officially when no password keychain exists; otherwise unlocks.
 */
export async function ensureMasterPassVaultConfigured(
  input: InitializeMasterPassVaultInput
): Promise<EnsureMasterPassVaultResult> {
  const { userId, masterPassword } = input;

  const hasVault = await userHasPasswordKeychain(userId);
  if (!hasVault) {
    await initializeMasterPassVault(input);
    return 'initialized';
  }

  const unlocked = await masterPassCrypto.unlock(masterPassword, userId, false);
  if (!unlocked) {
    throw new Error('Vault exists but the password could not unlock it. Use Settings to reset your vault.');
  }

  return 'unlocked';
}
