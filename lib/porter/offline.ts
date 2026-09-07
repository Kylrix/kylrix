/**
 * Offline-first Porter import/export — LocalEngine first, remote when available.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import type { PorterDiscernResult, PorterImportBundle } from './types';
import { bundleItemCount, toImportBundle } from './discern';

const DRAFT_KEY = (userId: string) => `porter_draft_${userId}`;

export async function cachePorterDraft(userId: string, result: PorterDiscernResult): Promise<void> {
  if (!userId) return;
  try {
    await LocalEngine.cacheSet(DRAFT_KEY(userId), {
      result,
      savedAt: new Date().toISOString(),
    });
  } catch {
    /* offline ok */
  }
}

export async function loadPorterDraft(
  userId: string,
): Promise<{ result: PorterDiscernResult; savedAt: string } | null> {
  if (!userId) return null;
  try {
    return (await LocalEngine.cacheGet(DRAFT_KEY(userId))) as any;
  } catch {
    return null;
  }
}

export async function clearPorterDraft(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await LocalEngine.cacheDelete(DRAFT_KEY(userId));
  } catch {
    /* ignore */
  }
}

/** Build payload ImportService / background task understands. */
export function bundleToKylrixVaultJson(bundle: PorterImportBundle, userId: string): string {
  return JSON.stringify({
    version: 2,
    format: 'kylrix-vault',
    exportedAt: new Date().toISOString(),
    userId,
    credentials: bundle.credentials.map((c) => ({
      userId,
      name: c.name,
      username: c.username ?? null,
      password: c.password ?? null,
      url: c.url ?? null,
      notes: c.notes ?? null,
      itemType: c.itemType || 'login',
      isEnv: Boolean(c.isEnv),
      customFields: c.customFields ? JSON.stringify(c.customFields) : null,
      tags: c.tags || [],
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    totpSecrets: bundle.totpSecrets.map((t) => ({
      userId,
      secretKey: t.secretKey,
      issuer: t.issuer,
      accountName: t.accountName,
      algorithm: t.algorithm || 'SHA1',
      digits: t.digits || 6,
      period: t.period || 30,
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    folders: bundle.folders.map((f) => ({
      userId,
      name: f.name,
      parentFolderId: null,
      sortOrder: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  });
}

export async function runOfflinePorterImport(
  result: PorterDiscernResult,
  userId: string,
  onProgress?: (msg: string, processed: number, total: number) => void,
): Promise<{
  success: boolean;
  summary: {
    foldersCreated: number;
    credentialsCreated: number;
    totpSecretsCreated: number;
    errors: number;
    skipped: number;
    skippedExisting: number;
  };
  errors: string[];
}> {
  const bundle = toImportBundle(result);
  const total = bundleItemCount(bundle);
  onProgress?.('Preparing import…', 0, total);

  const { ImportService } = await import('@/utils/import/import-service');
  const service = new ImportService((p) => {
    onProgress?.(p.message, p.itemsProcessed, p.itemsTotal || total);
  });

  const json = bundleToKylrixVaultJson(bundle, userId);
  // Always prefer client path for offline intelligence (encrypt → LocalEngine → sync)
  return service.importKylrixVaultData(json, userId);
}

/** Local-first vault export — LocalEngine mirror first, then VaultService lists. */
export async function exportVaultOffline(userId: string): Promise<{
  version: number;
  format: string;
  exportedAt: string;
  userId: string;
  data: { vault: { folders: unknown[]; credentials: unknown[]; totpSecrets: unknown[] } };
}> {
  const { VaultService } = await import('@/lib/appwrite/vault-service');

  // Prefer the same LocalEngine list keys the vault UI paints from.
  let creds =
    ((await LocalEngine.cacheGet<any[]>(`vault_credentials_${userId}`).catch(() => null)) as any[]) ||
    [];
  let totps =
    ((await LocalEngine.cacheGet<any[]>(`vault_totp_${userId}`).catch(() => null)) as any[]) || [];
  let folders: any[] = [];

  const [remoteCreds, remoteTotps, remoteFolders] = await Promise.all([
    VaultService.listAllCredentials(userId).catch(() => [] as any[]),
    VaultService.listTOTPSecrets(userId).catch(() => [] as any[]),
    VaultService.listFolders(userId).catch(() => [] as any[]),
  ]);

  if (!creds.length && Array.isArray(remoteCreds) && remoteCreds.length) creds = remoteCreds;
  if (!totps.length && Array.isArray(remoteTotps) && remoteTotps.length) totps = remoteTotps;
  folders = Array.isArray(remoteFolders) ? remoteFolders : [];

  // Merge remote into local by $id when both exist (remote may be fresher for a subset).
  if (Array.isArray(remoteCreds) && remoteCreds.length && creds.length) {
    const byId = new Map<string, any>();
    for (const row of [...creds, ...remoteCreds]) {
      const id = row?.$id || row?.id;
      if (id) byId.set(id, row);
    }
    creds = Array.from(byId.values());
  }
  if (Array.isArray(remoteTotps) && remoteTotps.length && totps.length) {
    const byId = new Map<string, any>();
    for (const row of [...totps, ...remoteTotps]) {
      const id = row?.$id || row?.id;
      if (id) byId.set(id, row);
    }
    totps = Array.from(byId.values());
  }

  return {
    version: 2,
    format: 'kylrix-vault',
    exportedAt: new Date().toISOString(),
    userId,
    data: {
      vault: {
        folders,
        credentials: creds,
        totpSecrets: totps,
      },
    },
  };
}
