/**
 * Critical-value identity + subset / superset / mutex merge for Porter imports.
 *
 * Critical values (never name alone):
 * - credentials → password
 * - smart codes → secret key
 *
 * Same critical value ⇒ related. Then:
 * - subset discarded, superset kept unmodified
 * - mutex extras ⇒ merge; prefer later item (date, else later in batch) for name + conflicts
 */

import { looksEncrypted } from '@/lib/masterpass-crypto';

export function isSealedVaultText(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return looksEncrypted(value);
}

/** Extract otpauth secret= or bare secret; normalize for comparison. */
export function normalizeTotpSecret(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s || isSealedVaultText(s)) return '';
  if (/^otpauth:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const secret = url.searchParams.get('secret') || '';
      s = secret;
    } catch {
      const m = s.match(/[?&]secret=([^&]+)/i);
      s = m ? decodeURIComponent(m[1]) : '';
    }
  }
  s = s.replace(/\s+/g, '').toUpperCase();
  // Strip common accidental quotes
  s = s.replace(/^["']+|["']+$/g, '');
  return s;
}

/** Plausible authenticator secret — base32 (len ≥ 8) or even-length hex (≥ 16). */
export function isPlausibleTotpSecret(raw: unknown): boolean {
  const s = normalizeTotpSecret(raw);
  if (!s || s.length < 8) return false;
  if (/^[A-Z2-7]+=*$/.test(s)) return true;
  // Some apps store hex seeds; accept even length
  if (/^[0-9A-F]+$/.test(s) && s.length % 2 === 0 && s.length >= 16) return true;
  // Lenient: mostly base32 with a few odd chars (export corruption) — still usable by base32ToBuffer skip
  const base32Chars = (s.match(/[A-Z2-7]/g) || []).length;
  if (base32Chars >= 8 && base32Chars / s.length >= 0.85) return true;
  return false;
}

export function normalizePassword(raw: unknown): string {
  const s = String(raw ?? '');
  if (!s || isSealedVaultText(s)) return '';
  return s;
}

export function criticalCredentialKey(row: Record<string, unknown>): string | null {
  const pass = normalizePassword(row.password);
  if (!pass) return null;
  return `pass:${pass}`;
}

export function criticalTotpKey(row: Record<string, unknown>): string | null {
  const sk = normalizeTotpSecret(row.secretKey ?? row.secret ?? row.token);
  if (!sk || !isPlausibleTotpSecret(sk)) return null;
  return `sk:${sk}`;
}

function normField(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function parseCustomFields(raw: unknown): Array<{ label: string; value: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((f: any) => ({
        label: String(f?.label ?? f?.name ?? '').trim(),
        value: String(f?.value ?? '').trim(),
      }))
      .filter((f) => f.label || f.value);
  }
  if (typeof raw === 'string') {
    try {
      return parseCustomFields(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

/** Comparable non-critical field bag (critical password/secret excluded from equality bag). */
export function credentialFieldBag(row: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  const name = String(row.name ?? '').trim();
  const user = String(row.username ?? '').trim();
  const url = String(row.url ?? '').trim();
  const notes = String(row.notes ?? '').trim();
  const totp = String(row.totpUri ?? row.totp ?? '').trim();
  if (name) m.set('name', name);
  if (user) m.set('username', user);
  if (url) m.set('url', url);
  if (notes) m.set('notes', notes);
  if (totp) m.set('totp', totp);
  for (const f of parseCustomFields(row.customFields)) {
    const key = `cf:${normField(f.label) || f.label}`;
    if (f.value) m.set(key, f.value);
  }
  return m;
}

export function totpFieldBag(row: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  const issuer = String(row.issuer ?? '').trim();
  const account = String(row.accountName ?? '').trim();
  const algo = String(row.algorithm ?? 'SHA1').trim().toUpperCase();
  const digits = String(row.digits ?? 6);
  const period = String(row.period ?? 30);
  if (issuer) m.set('issuer', issuer);
  if (account) m.set('accountName', account);
  if (algo) m.set('algorithm', algo);
  if (digits) m.set('digits', digits);
  if (period) m.set('period', period);
  return m;
}

export type CriticalRelation = 'equal' | 'subset' | 'superset' | 'mutex';

/** Classify related items (caller already ensured same critical key). */
export function classifyFieldRelation(
  incoming: Map<string, string>,
  existing: Map<string, string>,
): CriticalRelation {
  let onlyIn = 0;
  let onlyEx = 0;
  let conflict = 0;
  let shared = 0;

  for (const [k, v] of incoming) {
    if (!existing.has(k)) onlyIn++;
    else if (existing.get(k) !== v) conflict++;
    else shared++;
  }
  for (const [k] of existing) {
    if (!incoming.has(k)) onlyEx++;
  }

  if (conflict === 0 && onlyIn === 0 && onlyEx === 0) return 'equal';
  if (conflict === 0 && onlyIn === 0 && onlyEx > 0) return 'subset'; // incoming ⊂ existing
  if (conflict === 0 && onlyEx === 0 && onlyIn > 0) return 'superset'; // incoming ⊃ existing
  return 'mutex';
}

export function rowTimestamp(row: Record<string, unknown>): number {
  const raw =
    row.updatedAt ||
    row.$updatedAt ||
    row.createdAt ||
    row.$createdAt ||
    row.exportedAt ||
    '';
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

/** Prefer later by date; if tied/missing, prefer `b` (later in batch / incoming). */
export function preferLaterRow(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const ta = rowTimestamp(a);
  const tb = rowTimestamp(b);
  if (tb !== ta) return tb >= ta ? b : a;
  return b;
}

function mergeMaps(
  a: Map<string, string>,
  b: Map<string, string>,
  preferB: boolean,
): Map<string, string> {
  const out = new Map(a);
  for (const [k, v] of b) {
    if (!out.has(k)) out.set(k, v);
    else if (out.get(k) !== v && preferB) out.set(k, v);
  }
  return out;
}

function applyCredFields(row: Record<string, unknown>, fields: Map<string, string>): Record<string, unknown> {
  const custom: Array<{ label: string; value: string }> = [];
  const next = { ...row };
  if (fields.has('name')) next.name = fields.get('name');
  if (fields.has('username')) next.username = fields.get('username');
  if (fields.has('url')) next.url = fields.get('url');
  if (fields.has('notes')) next.notes = fields.get('notes');
  if (fields.has('totp')) {
    next.totpUri = fields.get('totp');
    next.totp = fields.get('totp');
  }
  for (const [k, v] of fields) {
    if (k.startsWith('cf:')) {
      custom.push({ label: k.slice(3), value: v });
    }
  }
  if (custom.length) next.customFields = custom;
  return next;
}

function applyTotpFields(row: Record<string, unknown>, fields: Map<string, string>): Record<string, unknown> {
  const next = { ...row };
  if (fields.has('issuer')) next.issuer = fields.get('issuer');
  if (fields.has('accountName')) next.accountName = fields.get('accountName');
  if (fields.has('algorithm')) next.algorithm = fields.get('algorithm');
  if (fields.has('digits')) next.digits = Number(fields.get('digits'));
  if (fields.has('period')) next.period = Number(fields.get('period'));
  return next;
}

/**
 * Collapse a batch by critical key: keep supersets, merge mutex, drop subsets.
 * Later items win name/conflicts when dates tie.
 */
export function coalesceByCriticalKey(
  rows: Record<string, unknown>[],
  kind: 'cred' | 'totp',
): { kept: Record<string, unknown>[]; dropped: number } {
  const groups = new Map<string, Record<string, unknown>[]>();
  const noCritical: Record<string, unknown>[] = [];

  for (const row of rows) {
    const key = kind === 'cred' ? criticalCredentialKey(row) : criticalTotpKey(row);
    if (!key) {
      noCritical.push(row);
      continue;
    }
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const kept: Record<string, unknown>[] = [...noCritical];
  let dropped = 0;

  for (const [, group] of groups) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    let winner = group[0];
    for (let i = 1; i < group.length; i++) {
      const challenger = group[i];
      const wFields = kind === 'cred' ? credentialFieldBag(winner) : totpFieldBag(winner);
      const cFields = kind === 'cred' ? credentialFieldBag(challenger) : totpFieldBag(challenger);
      const rel = classifyFieldRelation(cFields, wFields);
      // Rel from challenger vs winner: subset ⇒ challenger ⊂ winner ⇒ drop challenger
      if (rel === 'equal' || rel === 'subset') {
        dropped++;
        // equal: prefer later for display name
        if (rel === 'equal') {
          const later = preferLaterRow(winner, challenger);
          if (later === challenger) {
            winner = kind === 'cred'
              ? applyCredFields(challenger, wFields)
              : applyTotpFields(challenger, wFields);
            // keep later's name — challenger already has it when later === challenger
            winner = { ...winner, ...pickIdentity(later, kind) };
          }
        }
        continue;
      }
      if (rel === 'superset') {
        // challenger ⊃ winner — discard winner
        dropped++;
        winner = challenger;
        continue;
      }
      // mutex — merge; prefer later for conflicts + name
      const later = preferLaterRow(winner, challenger);
      const preferB = later === challenger;
      const mergedFields = mergeMaps(wFields, cFields, preferB);
      const base = preferB ? challenger : winner;
      winner =
        kind === 'cred'
          ? applyCredFields({ ...base, password: winner.password ?? challenger.password }, mergedFields)
          : applyTotpFields(
              {
                ...base,
                secretKey: normalizeTotpSecret(winner.secretKey ?? challenger.secretKey),
              },
              mergedFields,
            );
      // Always take later display name
      winner = { ...winner, ...pickIdentity(later, kind) };
      dropped++; // one logical slot kept
    }
    kept.push(winner);
  }

  return { kept, dropped };
}

function pickIdentity(row: Record<string, unknown>, kind: 'cred' | 'totp'): Record<string, unknown> {
  if (kind === 'cred') {
    return { name: row.name };
  }
  return { issuer: row.issuer, accountName: row.accountName };
}

export type VaultMatchDecision =
  | { action: 'skip'; reason: string; relation: CriticalRelation }
  | { action: 'import'; reason?: string; relation: CriticalRelation; mergeTargetId?: string };

/**
 * Decide how an incoming row relates to existing vault rows sharing its critical key.
 */
export function decideAgainstVault(
  incoming: Record<string, unknown>,
  vaultMatches: Record<string, unknown>[],
  kind: 'cred' | 'totp',
): VaultMatchDecision {
  if (!vaultMatches.length) {
    return { action: 'import', relation: 'equal' };
  }

  const inFields = kind === 'cred' ? credentialFieldBag(incoming) : totpFieldBag(incoming);
  let best: VaultMatchDecision | null = null;

  for (const existing of vaultMatches) {
    const exFields = kind === 'cred' ? credentialFieldBag(existing) : totpFieldBag(existing);
    const rel = classifyFieldRelation(inFields, exFields);
    const id = String(existing.$id || existing.id || '').trim() || undefined;

    if (rel === 'equal' || rel === 'subset') {
      return {
        action: 'skip',
        relation: rel,
        reason:
          kind === 'totp'
            ? 'Same smart code secret already in your vault'
            : 'Same password already in your vault',
      };
    }

    if (rel === 'superset') {
      // Incoming is richer — keep it (update path via mergeTargetId when possible)
      best = {
        action: 'import',
        relation: 'superset',
        mergeTargetId: id,
        reason: 'Richer than a simpler copy already in your vault',
      };
      continue;
    }

    // mutex
    const candidate: VaultMatchDecision = {
      action: 'import',
      relation: 'mutex',
      mergeTargetId: id,
      reason:
        kind === 'totp'
          ? 'Related smart code (same secret) — will merge details'
          : 'Related secret (same password) — will merge details',
    };
    if (!best || best.relation === 'superset') {
      // prefer keeping an existing merge target; mutex still imports
      if (!best) best = candidate;
    } else {
      best = candidate;
    }
  }

  return best || { action: 'import', relation: 'mutex' };
}
