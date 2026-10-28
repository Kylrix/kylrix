import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { MFA_RECOVERY_KIND, MFA_RECOVERY_VAULT_NAME } from '@/lib/mfa';

const RECOVERY_TAG = `system:${MFA_RECOVERY_KIND}`;

export async function persistMfaRecoveryCodes(
  userId: string,
  codes: string[],
  metadata: Record<string, unknown> = {}): Promise<void> {
  if (!codes.length) return;

  const { ApiResources } = await import('@/lib/api/resources');
  const actor = { userId, scopes: ['vault:write', 'vault:read'] } as any;

  const itemName = `KYLRIX RECOVERY CODE`.trim();

  await ecosystemSecurity.saveRecoveryIdentity(userId, codes, {
    source: 'mfa',
    vaultName: itemName,
    ...metadata});

  const notes = codes.join('\n');
  const existing = await findMfaRecoveryCredential(userId);
  const payload = {
    userId,
    name: itemName,
    username: 'User',
    password: codes.join(' '),
    itemType: 'note',
    notes,
    tags: [RECOVERY_TAG, 'system:mfa'],
    isFavorite: false,
    isDeleted: false};

  if (existing) {
    await ApiResources.updateVaultItem(actor, (existing as any).id || (existing as any).$id, payload);
    return;
  }

  await ApiResources.createVaultItem(actor, payload);
}

export async function loadMfaRecoveryCodes(userId: string): Promise<string[] | null> {
  const fromVaultUser = await ecosystemSecurity.loadRecoveryIdentity(userId).catch(() => null);
  if (fromVaultUser?.length) {
    return fromVaultUser;
  }

  const credential = (await findMfaRecoveryCredential(userId)) as any;
  if (!credential?.notes) {
    return null;
  }

  const codes = (credential.notes as string)
    .split('\n')
    .map((line: any) => line.trim())
    .filter(Boolean);

  return codes.length ? codes : null;
}

async function findMfaRecoveryCredential(userId: string) {
  const { ApiResources } = await import('@/lib/api/resources');
  const actor = { userId, scopes: ['vault:read'] } as any;
  const rows = await ApiResources.listVaultItems(actor).catch(() => []);
  return rows.find((row: any) => {
    if (row.name === MFA_RECOVERY_VAULT_NAME) return true;
    return Array.isArray(row.tags) && row.tags.includes(RECOVERY_TAG);
  }) || null;
}
