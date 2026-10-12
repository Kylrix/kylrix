/**
 * Sealed vault create-drafts (LocalEngine-only).
 * Plaintext never hits disk — seal with MEK, store under draft keys distinct from object mirrors.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  decryptField,
  encryptField,
  masterPassCrypto,
} from '@/lib/masterpass-crypto';

export type VaultDraftKind = 'secret' | 'totp';

const DRAFT_KEY = (kind: VaultDraftKind, userId: string) =>
  `vault_draft_${kind}_${userId || 'guest'}`;

const LEGACY_PLAIN_KEYS = ['kylrix:draft:secret', 'kylrix:draft:totp'] as const;

export type SecretComposeDraft = {
  v: 1;
  form: Record<string, string>;
  customFields: Array<{ id: string; label: string; value: string }>;
  isEnvMode: boolean;
  isNameManuallyEdited: boolean;
  defaultType?: string;
  updatedAt: number;
};

export type TotpComposeDraft = {
  v: 1;
  form: {
    issuer: string;
    accountName: string;
    secretKey: string;
    folderId: string;
    algorithm: string;
    digits: number;
    period: number;
  };
  showAdvanced?: boolean;
  updatedAt: number;
};

type DraftBlob = { cipher: string; updatedAt: number };

export function wipeLegacyPlainVaultDrafts(): void {
  if (typeof window === 'undefined') return;
  for (const k of LEGACY_PLAIN_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
}

function isMeaningfulSecretDraft(d: SecretComposeDraft): boolean {
  const f = d.form || {};
  if (d.isEnvMode && (d.customFields?.length || 0) > 0) return true;
  return Boolean(
    String(f.name || '').trim() ||
      String(f.username || '').trim() ||
      String(f.password || '').trim() ||
      String(f.cardNumber || '').trim() ||
      String(f.notes || '').trim() ||
      (d.customFields?.length || 0) > 0,
  );
}

function isMeaningfulTotpDraft(d: TotpComposeDraft): boolean {
  const f = d.form || {};
  return Boolean(
    String(f.issuer || '').trim() ||
      String(f.accountName || '').trim() ||
      String(f.secretKey || '').trim(),
  );
}

export async function writeSealedVaultDraft(
  userId: string,
  kind: 'secret',
  payload: Omit<SecretComposeDraft, 'v' | 'updatedAt'>,
): Promise<void>;
export async function writeSealedVaultDraft(
  userId: string,
  kind: 'totp',
  payload: Omit<TotpComposeDraft, 'v' | 'updatedAt'>,
): Promise<void>;
export async function writeSealedVaultDraft(
  userId: string,
  kind: VaultDraftKind,
  payload: Omit<SecretComposeDraft, 'v' | 'updatedAt'> | Omit<TotpComposeDraft, 'v' | 'updatedAt'>,
): Promise<void> {
  const uid = userId || 'guest';
  const key = DRAFT_KEY(kind, uid);

  if (!masterPassCrypto.isVaultUnlocked()) {
    // Never fall back to plaintext — drop any prior sealed draft instead.
    await LocalEngine.cacheSet(key, null);
    return;
  }

  const full =
    kind === 'secret'
      ? ({ ...(payload as SecretComposeDraft), v: 1 as const, updatedAt: Date.now() } satisfies SecretComposeDraft)
      : ({ ...(payload as TotpComposeDraft), v: 1 as const, updatedAt: Date.now() } satisfies TotpComposeDraft);

  const meaningful =
    kind === 'secret'
      ? isMeaningfulSecretDraft(full as SecretComposeDraft)
      : isMeaningfulTotpDraft(full as TotpComposeDraft);

  if (!meaningful) {
    await LocalEngine.cacheSet(key, null);
    return;
  }

  const cipher = await encryptField(JSON.stringify(full));
  const blob: DraftBlob = { cipher, updatedAt: Date.now() };
  await LocalEngine.cacheSet(key, blob);
}

export async function readSealedVaultDraft(
  userId: string,
  kind: 'secret',
): Promise<SecretComposeDraft | null>;
export async function readSealedVaultDraft(
  userId: string,
  kind: 'totp',
): Promise<TotpComposeDraft | null>;
export async function readSealedVaultDraft(
  userId: string,
  kind: VaultDraftKind,
): Promise<SecretComposeDraft | TotpComposeDraft | null> {
  if (!masterPassCrypto.isVaultUnlocked()) return null;
  const uid = userId || 'guest';
  const hit = await LocalEngine.cacheGet<DraftBlob | null>(DRAFT_KEY(kind, uid));
  if (!hit?.cipher || typeof hit.cipher !== 'string') return null;
  try {
    const plain = await decryptField(hit.cipher);
    const parsed = JSON.parse(plain);
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    // Corrupt / wrong MEK — drop so we never leave junk.
    await LocalEngine.cacheSet(DRAFT_KEY(kind, uid), null);
    return null;
  }
}

export async function clearSealedVaultDraft(
  userId: string,
  kind: VaultDraftKind,
): Promise<void> {
  await LocalEngine.cacheSet(DRAFT_KEY(kind, userId || 'guest'), null);
  wipeLegacyPlainVaultDrafts();
}
