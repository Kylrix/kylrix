/**
 * Offline-first Porter import/export — LocalEngine first, remote when available.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { looksEncrypted as masterLooksEncrypted } from '@/lib/masterpass-crypto';
import type { PorterDiscernResult, PorterImportBundle } from './types';
import { bundleItemCount, toImportBundle } from './discern';

const DRAFT_KEY = (userId: string) => `porter_draft_${userId}`;

export type PorterDraftDirection = 'import' | 'export';
export type PorterDraftDataKind = 'secrets' | 'totp' | 'mixed' | 'auto';

export type PorterSessionDraft = {
  direction: PorterDraftDirection;
  dataKind: PorterDraftDataKind;
  /** Optional file name for import sessions */
  fileName?: string | null;
  result?: PorterDiscernResult | null;
  exportFormat?: 'json' | 'encrypted-html';
  /** Last UI step so resume lands in the right place */
  view?: 'home' | 'pick-kind' | 'import' | 'preview' | 'review-skipped' | 'export-format';
  savedAt: string;
};

export async function cachePorterDraft(
  userId: string,
  draft: Omit<PorterSessionDraft, 'savedAt'> | PorterDiscernResult,
): Promise<void> {
  if (!userId) return;
  try {
    // Back-compat: older callers passed only a discern result (import preview)
    const normalized: PorterSessionDraft =
      draft && typeof draft === 'object' && 'direction' in draft
        ? { ...(draft as Omit<PorterSessionDraft, 'savedAt'>), savedAt: new Date().toISOString() }
        : {
            direction: 'import',
            dataKind: 'mixed',
            result: draft as PorterDiscernResult,
            savedAt: new Date().toISOString(),
          };
    await LocalEngine.cacheSet(DRAFT_KEY(userId), normalized);
  } catch {
    /* offline ok */
  }
}

export async function loadPorterDraft(userId: string): Promise<PorterSessionDraft | null> {
  if (!userId) return null;
  try {
    const raw = (await LocalEngine.cacheGet(DRAFT_KEY(userId))) as any;
    if (!raw) return null;
    // Legacy shape: { result, savedAt }
    if (raw.result && !raw.direction) {
      return {
        direction: 'import',
        dataKind: 'mixed',
        result: normalizeDiscernWorkspaces(raw.result),
        fileName: null,
        savedAt: raw.savedAt || new Date().toISOString(),
      };
    }
    if (!raw.direction) return null;
    return {
      ...(raw as PorterSessionDraft),
      result: raw.result ? normalizeDiscernWorkspaces(raw.result) : raw.result,
    };
  } catch {
    return null;
  }
}

function normalizeDiscernWorkspaces(result: PorterDiscernResult): PorterDiscernResult {
  const anyResult = result as any;
  const workspaces =
    anyResult.workspaces ||
    (Array.isArray(anyResult.folders)
      ? anyResult.folders.map((f: any) => ({
          ...f,
          kind: 'workspace' as const,
        }))
      : []);
  return {
    ...result,
    credentials: Array.isArray(anyResult.credentials) ? anyResult.credentials : [],
    totpSecrets: Array.isArray(anyResult.totpSecrets) ? anyResult.totpSecrets : [],
    workspaces,
    warnings: Array.isArray(anyResult.warnings) ? anyResult.warnings : [],
  };
}

/** True when a draft still has reviewable import items. */
export function draftHasImportPreview(draft: PorterSessionDraft | null | undefined): boolean {
  if (!draft?.result) return false;
  const r = draft.result;
  return (
    (r.credentials?.length || 0) + (r.totpSecrets?.length || 0) + (r.workspaces?.length || 0) > 0
  );
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
  const creds = bundle.credentials.filter(
    (c) => c._forceImport || !c._status || c._status === 'new' || c._status === 'merged',
  );
  const totps = bundle.totpSecrets.filter(
    (t) => t._forceImport || !t._status || t._status === 'new' || t._status === 'merged',
  );
  return JSON.stringify({
    version: 2,
    format: 'kylrix-vault',
    exportedAt: new Date().toISOString(),
    userId,
    credentials: creds.map((c) => ({
      ...(c.sourceId ? { $id: c.sourceId, id: c.sourceId } : {}),
      ...(c._mergeTargetId ? { _mergeTargetId: c._mergeTargetId } : {}),
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
    totpSecrets: totps.map((t) => ({
      ...(t.sourceId ? { $id: t.sourceId, id: t.sourceId } : {}),
      ...(t._mergeTargetId ? { _mergeTargetId: t._mergeTargetId } : {}),
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
    folders: bundle.workspaces.map((f) => ({
      ...(f.sourceId ? { $id: f.sourceId, id: f.sourceId } : {}),
      userId,
      name: f.name,
      parentFolderId: null,
      sortOrder: 0,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    workspaces: bundle.workspaces.map((f) => ({
      ...(f.sourceId ? { $id: f.sourceId, id: f.sourceId } : {}),
      userId,
      name: f.name,
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
  const {
    annotatePorterDiscernResult,
    filterImportableDiscern,
    loadExistingVaultForDedupe,
  } = await import('./sanitize-import');
  const existing = await loadExistingVaultForDedupe(userId);
  const annotated = annotatePorterDiscernResult(result, existing);
  const importable = filterImportableDiscern(annotated);
  const bundle = toImportBundle(importable);
  const total = bundleItemCount(bundle);
  onProgress?.('Preparing import…', 0, total);

  if (total === 0) {
    const skippedInvalid =
      annotated.credentials.filter((c) => c._status === 'invalid' && !c._forceImport).length +
      annotated.totpSecrets.filter((t) => t._status === 'invalid' && !t._forceImport).length;
    const skippedExisting =
      annotated.credentials.filter((c) => c._status === 'duplicate' && !c._forceImport).length +
      annotated.totpSecrets.filter((t) => t._status === 'duplicate' && !t._forceImport).length;
    return {
      success: true,
      summary: {
        foldersCreated: 0,
        credentialsCreated: 0,
        totpSecretsCreated: 0,
        errors: 0,
        skipped: skippedInvalid,
        skippedExisting,
      },
      errors: [],
    };
  }

  const { ImportService } = await import('@/utils/import/import-service');
  const service = new ImportService((p) => {
    onProgress?.(p.message, p.itemsProcessed, p.itemsTotal || total);
  });

  const json = bundleToKylrixVaultJson(bundle, userId);
  // Always prefer client path for offline intelligence (encrypt → LocalEngine → sync)
  return service.importKylrixVaultData(json, userId);
}

/** Strip ciphertext / server chrome — export-safe plaintext row. */
function shapePlainCredential(row: Record<string, unknown>) {
  return {
    $id: row.$id || row.id || undefined,
    itemType: row.itemType || 'login',
    name: row.name ?? null,
    username: row.username ?? null,
    password: row.password ?? null,
    url: row.url ?? null,
    notes: row.notes ?? null,
    totpId: row.totpId ?? null,
    isEnv: Boolean(row.isEnv),
    customFields: (() => {
      const raw = row.customFields;
      if (!raw) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    })(),
    tags: Array.isArray(row.tags) ? row.tags : [],
    cardNumber: row.cardNumber ?? null,
    cardholderName: row.cardholderName ?? null,
    cardExpiry: row.cardExpiry ?? null,
    cardCVV: row.cardCVV ?? null,
    cardPIN: row.cardPIN ?? null,
    cardType: row.cardType ?? null,
    folderId: row.folderId ?? null,
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null,
  };
}

function shapePlainTotp(row: Record<string, unknown>) {
  return {
    $id: row.$id || row.id || undefined,
    issuer: row.issuer ?? null,
    accountName: row.accountName ?? null,
    secretKey: row.secretKey ?? null,
    algorithm: row.algorithm || 'SHA1',
    digits: row.digits ?? 6,
    period: row.period ?? 30,
    url: row.url ?? null,
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null,
  };
}

function looksEncrypted(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  return masterLooksEncrypted(val);
}

/** Plaintext vault export — decrypts before write. Requires unlocked vault. */
export async function exportVaultPlaintext(userId: string): Promise<{
  version: number;
  format: string;
  exportedAt: string;
  userId: string;
  plaintext: true;
  data: { vault: { workspaces: unknown[]; credentials: unknown[]; totpSecrets: unknown[] } };
}> {
  const { masterPassCrypto } = await import('@/lib/masterpass-crypto');
  if (!masterPassCrypto.isVaultUnlocked()) {
    throw new Error('Unlock your vault before exporting.');
  }

  const { VaultService } = await import('@/lib/appwrite/vault-service');

  let creds =
    ((await LocalEngine.cacheGet<any[]>(`vault_credentials_${userId}`).catch(() => null)) as any[]) ||
    [];
  let totps =
    ((await LocalEngine.cacheGet<any[]>(`vault_totp_${userId}`).catch(() => null)) as any[]) || [];

  const [remoteCreds, remoteTotps, remoteFolders] = await Promise.all([
    VaultService.listAllCredentials(userId).catch(() => [] as any[]),
    VaultService.listTOTPSecrets(userId).catch(() => [] as any[]),
    VaultService.listFolders(userId).catch(() => [] as any[]),
  ]);

  // Prefer decrypted remote lists when populated
  if (Array.isArray(remoteCreds) && remoteCreds.length) creds = remoteCreds;
  if (Array.isArray(remoteTotps) && remoteTotps.length) totps = remoteTotps;

  // Local mirror may still be ciphertext — decrypt via get* when needed
  if (creds.some((c) => looksEncrypted(c?.password) || looksEncrypted(c?.name) || looksEncrypted(c?.secretKey))) {
    const decrypted: any[] = [];
    for (const row of creds) {
      const id = row?.$id || row?.id;
      if (!id) continue;
      try {
        decrypted.push(await VaultService.getCredential(String(id)));
      } catch {
        decrypted.push(row);
      }
    }
    creds = decrypted;
  }

  if (totps.some((t) => looksEncrypted(t?.secretKey) || looksEncrypted(t?.issuer))) {
    const decrypted: any[] = [];
    for (const row of totps) {
      const id = row?.$id || row?.id;
      if (!id) continue;
      try {
        decrypted.push(await VaultService.getTOTPSecret(String(id)));
      } catch {
        decrypted.push(row);
      }
    }
    totps = decrypted;
  }

  return {
    version: 2,
    format: 'kylrix-vault',
    exportedAt: new Date().toISOString(),
    userId,
    plaintext: true,
    data: {
      vault: {
        workspaces: (remoteFolders || []).map((f: any) => ({
          $id: f.$id,
          name: f.name,
        })),
        credentials: creds.map((c) => shapePlainCredential(c as any)),
        totpSecrets: totps.map((t) => shapePlainTotp(t as any)),
      },
    },
  };
}

/** @deprecated Prefer exportVaultPlaintext for user-facing downloads. */
export async function exportVaultOffline(userId: string): Promise<{
  version: number;
  format: string;
  exportedAt: string;
  userId: string;
  data: { vault: { workspaces: unknown[]; credentials: unknown[]; totpSecrets: unknown[] } };
}> {
  const plain = await exportVaultPlaintext(userId);
  return {
    version: plain.version,
    format: plain.format,
    exportedAt: plain.exportedAt,
    userId: plain.userId,
    data: plain.data,
  };
}
