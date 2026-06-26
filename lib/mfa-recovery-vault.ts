import { ecosystemSecurity } from '@/lib/ecosystem/security';
import {
  createCredential,
  listAllCredentials,
  updateCredential,
} from '@/lib/appwrite/vault';
import { MFA_RECOVERY_KIND, MFA_RECOVERY_VAULT_NAME } from '@/lib/mfa';

const RECOVERY_TAG = `system:${MFA_RECOVERY_KIND}`;

export async function persistMfaRecoveryCodes(
  userId: string,
  codes: string[],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!codes.length) return;

  await ecosystemSecurity.saveRecoveryIdentity(userId, codes, {
    source: 'appwrite-mfa',
    vaultName: MFA_RECOVERY_VAULT_NAME,
    ...metadata,
  });

  const notes = codes.join('\n');
  const existing = await findMfaRecoveryCredential(userId);
  const payload = {
    userId,
    name: MFA_RECOVERY_VAULT_NAME,
    itemType: 'note',
    notes,
    tags: [RECOVERY_TAG],
    isFavorite: false,
    isDeleted: false,
  };

  if (existing) {
    await updateCredential(existing.$id, payload);
    return;
  }

  await createCredential(payload);
}

export async function loadMfaRecoveryCodes(userId: string): Promise<string[] | null> {
  const fromVaultUser = await ecosystemSecurity.loadRecoveryIdentity(userId).catch(() => null);
  if (fromVaultUser?.length) {
    return fromVaultUser;
  }

  const credential = await findMfaRecoveryCredential(userId);
  if (!credential?.notes) {
    return null;
  }

  const codes = credential.notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return codes.length ? codes : null;
}

async function findMfaRecoveryCredential(userId: string) {
  const rows = await listAllCredentials(userId);
  return rows.find((row) => {
    if (row.name === MFA_RECOVERY_VAULT_NAME) return true;
    return Array.isArray(row.tags) && row.tags.includes(RECOVERY_TAG);
  }) || null;
}
