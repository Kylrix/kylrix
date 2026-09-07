/**
 * Aggressive import sanitize + dedupe for Porter / ImportService.
 * Drops unreadable rows; fingerprints against live vault so re-imports of the
 * same export create zero duplicates by default.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import type { PorterCredentialDraft, PorterDiscernResult, PorterTotpDraft } from './types';

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

/** Ciphertext / sealed blobs must not participate in content fingerprints. */
export function looksLikeCiphertext(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s || isUnimportableText(s)) return false;
  return s.length > 40 && /^[A-Za-z0-9+/=]+$/.test(s.replace(/\s/g, ''));
}

/** Row cannot be safely written (broken export / sealed without key). */
export function isUnimportableCredential(c: Record<string, unknown>): boolean {
  const fields = [c.name, c.username, c.password, c.url, c.notes, c.secretKey];
  if (fields.some(isUnimportableText)) return true;
  // Need at least a usable title or login material
  const name = String(c.name || '').trim();
  const user = String(c.username || '').trim();
  const pass = String(c.password || '').trim();
  const url = String(c.url || '').trim();
  if (isUnimportableText(name) || isUnimportableText(user) || isUnimportableText(pass)) return true;
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
  const secret = String(t.secretKey || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!secret || secret.length < 8) return true;
  // Reject obvious ciphertext mistaken for secrets
  if (secret.includes('[') || secret.includes('DECRYPT')) return true;
  if (looksLikeCiphertext(t.secretKey)) return true;
  return false;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function normSecret(s: unknown): string {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normDomain(url?: string | null): string {
  if (!url) return '';
  try {
    let host = url.trim().toLowerCase();
    if (!host.startsWith('http://') && !host.startsWith('https://')) host = 'https://' + host;
    const hostname = new URL(host).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const p1 = parts[parts.length - 1];
      const p2 = parts[parts.length - 2];
      if ((p2.length <= 3 && p1.length <= 2) || (p2.length <= 2 && p1.length <= 3)) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch {
    return url
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0];
  }
}

/** Multiple fingerprints so same secret with/without url or id still matches. */
export function credentialFingerprints(c: Record<string, unknown>): string[] {
  const id = String(c.$id || c.id || c.sourceId || '').trim();
  const name = norm(c.name);
  const user = norm(c.username);
  const passRaw = String(c.password ?? '').trim();
  const passUsable = passRaw && !looksLikeCiphertext(passRaw) && !isUnimportableText(passRaw);
  const pass = passUsable ? passRaw : '';
  const domain = normDomain(c.url as string);
  const keys = new Set<string>();
  if (id) keys.add(`id:${id}`);
  if (user && pass) keys.add(`up:${user}|${pass}`);
  if (domain && user && pass) keys.add(`dup:${domain}|${user}|${pass}`);
  if (name && user && pass) keys.add(`nup:${name}|${user}|${pass}`);
  if (name && pass) keys.add(`np:${name}|${pass}`);
  if (c.isEnv && name) keys.add(`env:${name}`);
  return Array.from(keys);
}

export function totpFingerprints(t: Record<string, unknown>): string[] {
  const id = String(t.$id || t.id || t.sourceId || '').trim();
  const secretRaw = String(t.secretKey ?? '').trim();
  const secret =
    secretRaw && !looksLikeCiphertext(secretRaw) && !isUnimportableText(secretRaw)
      ? normSecret(secretRaw)
      : '';
  const issuer = norm(t.issuer);
  const account = norm(t.accountName);
  const keys = new Set<string>();
  if (id) keys.add(`id:${id}`);
  if (secret) keys.add(`sk:${secret}`);
  if (secret && issuer) keys.add(`isk:${issuer}|${secret}`);
  if (secret && account) keys.add(`ask:${account}|${secret}`);
  if (issuer && account && secret) keys.add(`ias:${issuer}|${account}|${secret}`);
  return Array.from(keys);
}

function indexFingerprints(rows: Record<string, unknown>[], kind: 'cred' | 'totp'): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const fps = kind === 'cred' ? credentialFingerprints(row) : totpFingerprints(row);
    fps.forEach((fp) => set.add(fp));
  }
  return set;
}

function matchesIndex(fps: string[], index: Set<string>): boolean {
  return fps.some((fp) => index.has(fp));
}

function preferPlaintextRow(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const aEnc =
    looksLikeCiphertext(a.password) ||
    looksLikeCiphertext(a.secretKey) ||
    looksLikeCiphertext(a.username) ||
    looksLikeCiphertext(a.name);
  const bEnc =
    looksLikeCiphertext(b.password) ||
    looksLikeCiphertext(b.secretKey) ||
    looksLikeCiphertext(b.username) ||
    looksLikeCiphertext(b.name);
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
 * dedupe within the batch, then against existing vault rows.
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
    if (isUnimportableTotp(t)) {
      skippedInvalid++;
      continue;
    }
    validTotps.push(t);
  }

  // Intra-batch dedupe
  const seenCred = new Set<string>();
  const uniqueCreds: Record<string, unknown>[] = [];
  for (const c of validCreds) {
    const fps = credentialFingerprints(c);
    if (fps.some((fp) => seenCred.has(fp))) {
      skippedDuplicateIncoming++;
      continue;
    }
    fps.forEach((fp) => seenCred.add(fp));
    uniqueCreds.push(c);
  }

  const seenTotp = new Set<string>();
  const uniqueTotps: Record<string, unknown>[] = [];
  for (const t of validTotps) {
    const fps = totpFingerprints(t);
    if (fps.some((fp) => seenTotp.has(fp))) {
      skippedDuplicateIncoming++;
      continue;
    }
    fps.forEach((fp) => seenTotp.add(fp));
    uniqueTotps.push(t);
  }

  const existingCredIndex = indexFingerprints(existing.credentials || [], 'cred');
  const existingTotpIndex = indexFingerprints(existing.totpSecrets || [], 'totp');

  credentials = [];
  for (const c of uniqueCreds) {
    if (matchesIndex(credentialFingerprints(c), existingCredIndex)) {
      skippedDuplicate++;
      continue;
    }
    credentials.push(c);
  }

  totpSecrets = [];
  for (const t of uniqueTotps) {
    if (matchesIndex(totpFingerprints(t), existingTotpIndex)) {
      skippedDuplicate++;
      continue;
    }
    totpSecrets.push(t);
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
 * Mark Porter preview rows as new / duplicate / invalid against live vault.
 * Invalid and duplicate stay visible but must not be imported.
 */
export function annotatePorterDiscernResult(
  result: PorterDiscernResult,
  existing: { credentials: Record<string, unknown>[]; totpSecrets: Record<string, unknown>[] },
): PorterDiscernResult {
  const credIndex = indexFingerprints(existing.credentials || [], 'cred');
  const totpIndex = indexFingerprints(existing.totpSecrets || [], 'totp');

  const credentials: PorterCredentialDraft[] = result.credentials.map((c) => {
    const row = { ...c, $id: c.sourceId, id: c.sourceId } as Record<string, unknown>;
    if (c._status === 'invalid' || isUnimportableCredential(row)) {
      return {
        ...c,
        _status: 'invalid' as const,
        _skipReason: c._skipReason || "Can't import — this item is unreadable",
      };
    }
    if (matchesIndex(credentialFingerprints(row), credIndex)) {
      return {
        ...c,
        _status: 'duplicate' as const,
        _skipReason: 'Already in your vault',
      };
    }
    return { ...c, _status: 'new' as const, _skipReason: undefined };
  });

  const totpSecrets: PorterTotpDraft[] = result.totpSecrets.map((t) => {
    const row = { ...t, $id: t.sourceId, id: t.sourceId } as Record<string, unknown>;
    if (t._status === 'invalid' || isUnimportableTotp(row)) {
      return {
        ...t,
        _status: 'invalid' as const,
        _skipReason: t._skipReason || "Can't import — this code is unreadable",
      };
    }
    if (matchesIndex(totpFingerprints(row), totpIndex)) {
      return {
        ...t,
        _status: 'duplicate' as const,
        _skipReason: 'Already in your vault',
      };
    }
    return { ...t, _status: 'new' as const, _skipReason: undefined };
  });

  const importableCreds = credentials.filter((c) => c._status === 'new').length;
  const importableTotp = totpSecrets.filter((t) => t._status === 'new').length;
  const skippedDup =
    credentials.filter((c) => c._status === 'duplicate').length +
    totpSecrets.filter((t) => t._status === 'duplicate').length;
  const skippedInvalid =
    credentials.filter((c) => c._status === 'invalid').length +
    totpSecrets.filter((t) => t._status === 'invalid').length;

  const warnings = [...(result.warnings || [])];
  if (skippedDup > 0) {
    warnings.push(`${skippedDup} item${skippedDup === 1 ? '' : 's'} already in your vault — skipped.`);
  }
  if (skippedInvalid > 0) {
    warnings.push(
      `${skippedInvalid} item${skippedInvalid === 1 ? '' : 's'} can't be imported (unreadable) — disabled.`,
    );
  }

  return {
    ...result,
    credentials,
    totpSecrets,
    summary: [
      importableCreds ? `${importableCreds} new secret${importableCreds === 1 ? '' : 's'}` : null,
      importableTotp ? `${importableTotp} new smart code${importableTotp === 1 ? '' : 's'}` : null,
      result.workspaces.length
        ? `${result.workspaces.length} workspace${result.workspaces.length === 1 ? '' : 's'}`
        : null,
      skippedDup ? `${skippedDup} already present` : null,
      skippedInvalid ? `${skippedInvalid} disabled` : null,
    ]
      .filter(Boolean)
      .join(' · ') || result.summary,
    warnings,
  };
}

/** Only rows that should be written. */
export function filterImportableDiscern(result: PorterDiscernResult): PorterDiscernResult {
  return {
    ...result,
    credentials: result.credentials.filter((c) => !c._status || c._status === 'new' || c._status === 'merged'),
    totpSecrets: result.totpSecrets.filter((t) => !t._status || t._status === 'new' || t._status === 'merged'),
  };
}

/** Load existing vault rows for dedupe (decrypted when possible). */
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
    credentials = mergeById(credentials, Array.isArray(remoteCreds) ? remoteCreds : []);
    totpSecrets = mergeById(totpSecrets, Array.isArray(remoteTotps) ? remoteTotps : []);

    // Decrypt any remaining ciphertext mirrors so content fingerprints work
    const needsCredDecrypt = credentials.some(
      (c) => looksLikeCiphertext(c?.password) || looksLikeCiphertext(c?.username) || looksLikeCiphertext(c?.name),
    );
    if (needsCredDecrypt) {
      const decrypted: Record<string, unknown>[] = [];
      for (const row of credentials) {
        const id = String(row?.$id || row?.id || '').trim();
        if (!id) {
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

    const needsTotpDecrypt = totpSecrets.some(
      (t) => looksLikeCiphertext(t?.secretKey) || looksLikeCiphertext(t?.issuer),
    );
    if (needsTotpDecrypt) {
      const decrypted: Record<string, unknown>[] = [];
      for (const row of totpSecrets) {
        const id = String(row?.$id || row?.id || '').trim();
        if (!id) {
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

  return {
    credentials: (credentials || []).filter((c) => c && !isUnimportableText(c.$id)),
    totpSecrets: (totpSecrets || []).filter((t) => t && !isUnimportableText(t.$id)),
  };
}
