/**
 * Aggressive import sanitize + critical-value dedupe for Porter / ImportService.
 *
 * Duplicates are decided by critical values only (password / TOTP secret) — never
 * name or row id alone. Related items use subset / superset / mutex merge rules.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import type { PorterCredentialDraft, PorterDiscernResult, PorterTotpDraft } from './types';
import {
  coalesceByCriticalKey,
  criticalCredentialKey,
  criticalTotpKey,
  decideAgainstVault,
  isPlausibleTotpSecret,
  isSealedVaultText,
  normalizeTotpSecret,
} from './critical-merge';

const UNIMPORTABLE_MARKERS = [
  '[DECRYPTION_DEK_UNAVAILABLE]',
  '[DECRYPTION_FAILED]',
  '[DECRYPTION_ERROR]',
  'DECRYPTION_DEK_UNAVAILABLE',
];

export function isUnimportableText(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  if (!s) return false;
  const upper = s.toUpperCase();
  return UNIMPORTABLE_MARKERS.some((m) => upper.includes(m.toUpperCase()));
}

/** @deprecated Use isSealedVaultText — kept for callers expecting this name. */
export function looksLikeCiphertext(value: unknown): boolean {
  return isSealedVaultText(value);
}

/** Row cannot be safely written (broken export / sealed without key). */
export function isUnimportableCredential(c: Record<string, unknown>): boolean {
  const fields = [c.name, c.username, c.password, c.url, c.notes, c.secretKey];
  if (fields.some(isUnimportableText)) return true;
  const name = String(c.name || '').trim();
  const user = String(c.username || '').trim();
  const pass = String(c.password || '').trim();
  const url = String(c.url || '').trim();
  if (isUnimportableText(name) || isUnimportableText(user) || isUnimportableText(pass)) return true;
  if (isSealedVaultText(pass) && isSealedVaultText(user) && isSealedVaultText(name)) return true;
  if (!name && !user && !pass && !url && !c.isEnv) return true;
  if (c.isEnv) {
    const raw = c.customFields;
    if (!raw) return true;
  }
  return false;
}

export function isUnimportableTotp(t: Record<string, unknown>): boolean {
  const fields = [t.secretKey, t.issuer, t.accountName];
  if (fields.some(isUnimportableText)) return true;
  const secret = normalizeTotpSecret(t.secretKey ?? t.secret ?? t.token);
  if (!secret) return true;
  if (isSealedVaultText(t.secretKey)) return true;
  // Only reject when the secret is not a plausible authenticator seed
  if (!isPlausibleTotpSecret(secret)) return true;
  return false;
}

/** Critical-value fingerprints only (password / secret). No name- or id-only keys. */
export function credentialFingerprints(c: Record<string, unknown>): string[] {
  const key = criticalCredentialKey(c);
  return key ? [key] : [];
}

export function totpFingerprints(t: Record<string, unknown>): string[] {
  const key = criticalTotpKey(t);
  return key ? [key] : [];
}

function indexByCritical(
  rows: Record<string, unknown>[],
  kind: 'cred' | 'totp',
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = kind === 'cred' ? criticalCredentialKey(row) : criticalTotpKey(row);
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function preferPlaintextRow(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const aEnc =
    isSealedVaultText(a.password) ||
    isSealedVaultText(a.secretKey) ||
    isSealedVaultText(a.username) ||
    isSealedVaultText(a.name);
  const bEnc =
    isSealedVaultText(b.password) ||
    isSealedVaultText(b.secretKey) ||
    isSealedVaultText(b.username) ||
    isSealedVaultText(b.name);
  if (aEnc && !bEnc) return b;
  if (bEnc && !aEnc) return a;
  return b;
}

function mergeById(
  local: Record<string, unknown>[],
  remote: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  const anon: Record<string, unknown>[] = [];
  for (const row of [...local, ...remote]) {
    if (!row) continue;
    const id = String(row.$id || row.id || '').trim();
    if (!id) {
      anon.push(row);
      continue;
    }
    const prev = byId.get(id);
    byId.set(id, prev ? preferPlaintextRow(prev, row) : row);
  }
  return [...byId.values(), ...anon];
}

export type SanitizeImportResult = {
  credentials: Record<string, unknown>[];
  totpSecrets: Record<string, unknown>[];
  workspaces: Record<string, unknown>[];
  /** @deprecated alias of workspaces for ImportService */
  folders: Record<string, unknown>[];
  skippedInvalid: number;
  skippedDuplicate: number;
  skippedDuplicateIncoming: number;
};

/**
 * Normalize kylrix export shapes (`data.vault` or top-level), drop invalid rows,
 * coalesce related rows in-batch, then against existing vault by critical value.
 */
export function sanitizeImportBundle(
  raw: {
    credentials?: unknown[];
    totpSecrets?: unknown[];
    workspaces?: unknown[];
    folders?: unknown[];
    data?: {
      vault?: {
        credentials?: unknown[];
        totpSecrets?: unknown[];
        workspaces?: unknown[];
        folders?: unknown[];
      };
    };
  },
  existing: { credentials: Record<string, unknown>[]; totpSecrets: Record<string, unknown>[] },
): SanitizeImportResult {
  const vault = raw?.data?.vault;
  let credentials = (Array.isArray(raw?.credentials) ? raw.credentials : vault?.credentials || []) as Record<
    string,
    unknown
  >[];
  let totpSecrets = (Array.isArray(raw?.totpSecrets)
    ? raw.totpSecrets
    : vault?.totpSecrets || []) as Record<string, unknown>[];
  let workspaces = (Array.isArray(raw?.workspaces)
    ? raw.workspaces
    : Array.isArray(raw?.folders)
      ? raw.folders
      : vault?.workspaces || vault?.folders || []) as Record<string, unknown>[];

  let skippedInvalid = 0;
  let skippedDuplicate = 0;
  let skippedDuplicateIncoming = 0;

  const validCreds: Record<string, unknown>[] = [];
  for (const c of credentials) {
    if (!c || typeof c !== 'object') {
      skippedInvalid++;
      continue;
    }
    if (isUnimportableCredential(c)) {
      skippedInvalid++;
      continue;
    }
    validCreds.push(c);
  }

  const validTotps: Record<string, unknown>[] = [];
  for (const t of totpSecrets) {
    if (!t || typeof t !== 'object') {
      skippedInvalid++;
      continue;
    }
    // Normalize secret before validity check
    const sk = normalizeTotpSecret(t.secretKey ?? t.secret ?? t.token);
    const normalized = { ...t, secretKey: sk || t.secretKey };
    if (isUnimportableTotp(normalized)) {
      skippedInvalid++;
      continue;
    }
    validTotps.push(normalized);
  }

  const credCoalesced = coalesceByCriticalKey(validCreds, 'cred');
  const totpCoalesced = coalesceByCriticalKey(validTotps, 'totp');
  skippedDuplicateIncoming += credCoalesced.dropped + totpCoalesced.dropped;

  const vaultCreds = indexByCritical(existing.credentials || [], 'cred');
  const vaultTotps = indexByCritical(existing.totpSecrets || [], 'totp');

  credentials = [];
  for (const c of credCoalesced.kept) {
    const key = criticalCredentialKey(c);
    if (!key) {
      credentials.push(c);
      continue;
    }
    const decision = decideAgainstVault(c, vaultCreds.get(key) || [], 'cred');
    if (decision.action === 'skip') {
      skippedDuplicate++;
      continue;
    }
    if (decision.action === 'import' && decision.mergeTargetId) {
      credentials.push({ ...c, _mergeTargetId: decision.mergeTargetId });
    } else {
      credentials.push(c);
    }
  }

  totpSecrets = [];
  for (const t of totpCoalesced.kept) {
    const key = criticalTotpKey(t);
    if (!key) {
      totpSecrets.push(t);
      continue;
    }
    const decision = decideAgainstVault(t, vaultTotps.get(key) || [], 'totp');
    if (decision.action === 'skip') {
      skippedDuplicate++;
      continue;
    }
    if (decision.action === 'import' && decision.mergeTargetId) {
      totpSecrets.push({ ...t, _mergeTargetId: decision.mergeTargetId });
    } else {
      totpSecrets.push(t);
    }
  }

  workspaces = (workspaces || []).filter((f) => f && !isUnimportableText(f.name));

  return {
    credentials,
    totpSecrets,
    workspaces,
    folders: workspaces,
    skippedInvalid,
    skippedDuplicate,
    skippedDuplicateIncoming,
  };
}

/**
 * Mark Porter preview rows as new / duplicate / merged / invalid against live vault.
 * Uses critical values (password / smart-code secret) only — never name or id alone.
 */
export function annotatePorterDiscernResult(
  result: PorterDiscernResult,
  existing: { credentials: Record<string, unknown>[]; totpSecrets: Record<string, unknown>[] },
): PorterDiscernResult {
  const safeCreds = Array.isArray(result.credentials) ? result.credentials : [];
  const safeTotps = Array.isArray(result.totpSecrets) ? result.totpSecrets : [];
  const safeWorkspaces = Array.isArray(result.workspaces) ? result.workspaces : [];

  // Intra-file coalesce first (subset discarded, mutex merged)
  const credRows = safeCreds.map((c) => ({ ...c })) as Record<string, unknown>[];
  const totpRows = safeTotps.map((t) => {
    const sk = normalizeTotpSecret(t.secretKey);
    return { ...t, secretKey: sk || t.secretKey };
  }) as Record<string, unknown>[];

  const credCoalesced = coalesceByCriticalKey(credRows, 'cred');
  const totpCoalesced = coalesceByCriticalKey(totpRows, 'totp');

  const vaultCreds = indexByCritical(existing.credentials || [], 'cred');
  const vaultTotps = indexByCritical(existing.totpSecrets || [], 'totp');

  const credentials: PorterCredentialDraft[] = credCoalesced.kept.map((row) => {
    const c = row as unknown as PorterCredentialDraft;
    const force = Boolean(c._forceImport);
    if (c._status === 'invalid' || isUnimportableCredential(row)) {
      return {
        ...c,
        _status: 'invalid' as const,
        _skipReason: c._skipReason || "Can't import — this item is unreadable",
        _forceImport: force || undefined,
      };
    }
    const key = criticalCredentialKey(row);
    if (!key) {
      // No password to compare — still importable if it has other material
      return { ...c, _status: 'new' as const, _skipReason: undefined, _forceImport: force || undefined };
    }
    const decision = decideAgainstVault(row, vaultCreds.get(key) || [], 'cred');
    const mergeTargetId = decision.action === 'import' ? decision.mergeTargetId : undefined;
    if (decision.action === 'skip' && !force) {
      return {
        ...c,
        _status: 'duplicate' as const,
        _skipReason: decision.reason,
        _forceImport: force || undefined,
      };
    }
    if (decision.relation === 'superset' || decision.relation === 'mutex') {
      return {
        ...c,
        _status: 'merged' as const,
        _skipReason: decision.reason,
        _mergeTargetId: mergeTargetId,
        _forceImport: force || undefined,
      };
    }
    return {
      ...c,
      _status: 'new' as const,
      _skipReason: undefined,
      _forceImport: force || undefined,
      _mergeTargetId: mergeTargetId,
    };
  });

  const totpSecrets: PorterTotpDraft[] = totpCoalesced.kept.map((row) => {
    const t = row as unknown as PorterTotpDraft;
    const force = Boolean(t._forceImport);
    const sk = normalizeTotpSecret(t.secretKey);
    const normalized = { ...t, secretKey: sk || t.secretKey };

    if (t._status === 'invalid' || isUnimportableTotp(row)) {
      return {
        ...normalized,
        _status: 'invalid' as const,
        _skipReason: t._skipReason || "Can't import — this code is unreadable",
        _forceImport: force || undefined,
      };
    }
    const key = criticalTotpKey(row);
    if (!key) {
      return {
        ...normalized,
        _status: 'invalid' as const,
        _skipReason: "Can't import — missing or unreadable smart code secret",
        _forceImport: force || undefined,
      };
    }
    const decision = decideAgainstVault(row, vaultTotps.get(key) || [], 'totp');
    const mergeTargetId = decision.action === 'import' ? decision.mergeTargetId : undefined;
    if (decision.action === 'skip' && !force) {
      return {
        ...normalized,
        _status: 'duplicate' as const,
        _skipReason: decision.reason,
        _forceImport: force || undefined,
      };
    }
    if (decision.relation === 'superset' || decision.relation === 'mutex') {
      return {
        ...normalized,
        _status: 'merged' as const,
        _skipReason: decision.reason,
        _mergeTargetId: mergeTargetId,
        _forceImport: force || undefined,
      };
    }
    return {
      ...normalized,
      _status: 'new' as const,
      _skipReason: undefined,
      _forceImport: force || undefined,
      _mergeTargetId: mergeTargetId,
    };
  });

  const importableCreds = credentials.filter((c) => isPorterRowImportable(c)).length;
  const importableTotp = totpSecrets.filter((t) => isPorterRowImportable(t)).length;
  const skippedDup =
    credentials.filter((c) => c._status === 'duplicate' && !c._forceImport).length +
    totpSecrets.filter((t) => t._status === 'duplicate' && !t._forceImport).length;
  const skippedInvalid =
    credentials.filter((c) => c._status === 'invalid' && !c._forceImport).length +
    totpSecrets.filter((t) => t._status === 'invalid' && !t._forceImport).length;
  const mergedCount =
    credentials.filter((c) => c._status === 'merged').length +
    totpSecrets.filter((t) => t._status === 'merged').length;

  const warnings = [...(result.warnings || [])];
  if (credCoalesced.dropped + totpCoalesced.dropped > 0) {
    warnings.push(
      `Combined ${credCoalesced.dropped + totpCoalesced.dropped} related item${credCoalesced.dropped + totpCoalesced.dropped === 1 ? '' : 's'} in the file (same password or smart code secret).`,
    );
  }
  if (skippedDup > 0) {
    warnings.push(
      `${skippedDup} item${skippedDup === 1 ? '' : 's'} already match a password or smart code secret in your vault — skipped.`,
    );
  }
  if (skippedInvalid > 0) {
    warnings.push(
      `${skippedInvalid} item${skippedInvalid === 1 ? '' : 's'} can't be imported (unreadable) — disabled.`,
    );
  }
  if (mergedCount > 0) {
    warnings.push(
      `${mergedCount} item${mergedCount === 1 ? '' : 's'} share a password or secret with your vault but carry extra details — kept for merge.`,
    );
  }

  return {
    ...result,
    credentials,
    totpSecrets,
    workspaces: safeWorkspaces,
    summary: [
      importableCreds ? `${importableCreds} secret${importableCreds === 1 ? '' : 's'}` : null,
      importableTotp ? `${importableTotp} smart code${importableTotp === 1 ? '' : 's'}` : null,
      safeWorkspaces.length
        ? `${safeWorkspaces.length} workspace${safeWorkspaces.length === 1 ? '' : 's'}`
        : null,
      skippedDup ? `${skippedDup} already present` : null,
      skippedInvalid ? `${skippedInvalid} disabled` : null,
      mergedCount ? `${mergedCount} to merge` : null,
    ]
      .filter(Boolean)
      .join(' · ') || result.summary,
    warnings,
  };
}

export function isPorterRowImportable(row: {
  _status?: string;
  _forceImport?: boolean;
}): boolean {
  if (row._forceImport) return true;
  return !row._status || row._status === 'new' || row._status === 'merged';
}

export function isPorterRowSkipped(row: {
  _status?: string;
  _forceImport?: boolean;
}): boolean {
  return (row._status === 'duplicate' || row._status === 'invalid') && !row._forceImport;
}

/** Only rows that should be written (includes user-enabled disputes). */
export function filterImportableDiscern(result: PorterDiscernResult): PorterDiscernResult {
  const credentials = Array.isArray(result.credentials) ? result.credentials : [];
  const totpSecrets = Array.isArray(result.totpSecrets) ? result.totpSecrets : [];
  const workspaces = Array.isArray(result.workspaces) ? result.workspaces : [];
  return {
    ...result,
    credentials: credentials.filter((c) => isPorterRowImportable(c)),
    totpSecrets: totpSecrets.filter((t) => isPorterRowImportable(t)),
    workspaces,
  };
}

/** Load existing vault rows for dedupe — always prefer decrypted remote rows. */
export async function loadExistingVaultForDedupe(userId: string): Promise<{
  credentials: Record<string, unknown>[];
  totpSecrets: Record<string, unknown>[];
}> {
  let credentials =
    ((await LocalEngine.cacheGet<any[]>(`vault_credentials_${userId}`).catch(() => null)) as any[]) ||
    [];
  let totpSecrets =
    ((await LocalEngine.cacheGet<any[]>(`vault_totp_${userId}`).catch(() => null)) as any[]) || [];

  try {
    const { VaultService } = await import('@/lib/appwrite/vault-service');
    const [remoteCreds, remoteTotps] = await Promise.all([
      VaultService.listAllCredentials(userId).catch(() => [] as any[]),
      VaultService.listTOTPSecrets(userId).catch(() => [] as any[]),
    ]);
    // Prefer remote (already decrypted when vault unlocked) over LocalEngine ciphertext
    credentials = mergeById(
      Array.isArray(remoteCreds) ? remoteCreds : [],
      credentials,
    );
    totpSecrets = mergeById(
      Array.isArray(remoteTotps) ? remoteTotps : [],
      totpSecrets,
    );

    // Force per-row decrypt whenever critical fields still look sealed
    const sealedCred = (c: Record<string, unknown>) =>
      isSealedVaultText(c?.password) || isSealedVaultText(c?.username) || isSealedVaultText(c?.name);
    const sealedTotp = (t: Record<string, unknown>) =>
      isSealedVaultText(t?.secretKey) || !criticalTotpKey(t);

    if (credentials.some(sealedCred)) {
      const decrypted: Record<string, unknown>[] = [];
      for (const row of credentials) {
        const id = String(row?.$id || row?.id || '').trim();
        if (!id || !sealedCred(row)) {
          decrypted.push(row);
          continue;
        }
        try {
          decrypted.push((await VaultService.getCredential(id)) as any);
        } catch {
          decrypted.push(row);
        }
      }
      credentials = decrypted;
    }

    if (totpSecrets.some(sealedTotp)) {
      const decrypted: Record<string, unknown>[] = [];
      for (const row of totpSecrets) {
        const id = String(row?.$id || row?.id || '').trim();
        if (!id || !sealedTotp(row)) {
          decrypted.push(row);
          continue;
        }
        try {
          decrypted.push((await VaultService.getTOTPSecret(id)) as any);
        } catch {
          decrypted.push(row);
        }
      }
      totpSecrets = decrypted;
    }
  } catch {
    /* offline — LocalEngine only */
  }

  // Drop rows we still cannot fingerprint (still sealed) — comparing sealed blobs is guessing
  return {
    credentials: (credentials || []).filter(
      (c) => c && !isUnimportableText(c.$id) && Boolean(criticalCredentialKey(c) || c.isEnv),
    ),
    totpSecrets: (totpSecrets || []).filter(
      (t) => t && !isUnimportableText(t.$id) && Boolean(criticalTotpKey(t)),
    ),
  };
}
