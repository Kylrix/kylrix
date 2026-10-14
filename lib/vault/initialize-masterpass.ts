'use client';

import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { systemTables } from '@/lib/data/system-tables';

export type InitializeMasterPassVaultInput = {
  userId: string;
  email: string;
  masterPassword: string;
  name?: string;
};

export type EnsureMasterPassVaultResult = 'initialized' | 'unlocked';

async function userHasPasswordKeychain(userId: string): Promise<boolean> {
  try {
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: 'vault',
      tableId: 'keychain',
      queries: [{ type: 'equal', attribute: 'userId', value: userId }],
    });
    return res.rows.some((entry: any) => entry.type === 'password');
  } catch {
    return false;
  }
}

/**
 * Canonical first-time vault setup used by signup, sign-in, and Settings.
 */
export async function initializeMasterPassVault(
  input: InitializeMasterPassVaultInput
): Promise<void> {
  const { userId, email, masterPassword } = input;
  const displayName = (input.name || '').trim() || email.split('@')[0];

  await masterPassCrypto.setupVault(masterPassword, userId);

  try {
    const { syncMasterpassToAccountPassword } = await import('@/lib/actions/client-ops');
    await syncMasterpassToAccountPassword(userId, masterPassword);
  } catch (syncErr) {
    console.warn('[Vault] Account password sync deferred/handled:', syncErr);
  }

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
 * After a successful password session, ensure vault is configured.
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
