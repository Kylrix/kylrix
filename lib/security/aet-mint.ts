// Client-side AET minting helpers. Consumed by browser code only; no server imports.
// Wraps the DEKs of permitted Rows under an AET wrapping key derived from the
// freshly generated etkSecret. The etk itself never leaves the client.

import {
  type AetEnvelope,
  type AetResourceKind,
  type AetResourceKey,
  type WrappedDekMap,
  AET_MAX_DEK_ENTRIES,
  bytesToBase64,
  deriveAetWrappingKey,
  getRowWrappedDek,
  unwrapRowDek,
  wrapDekEntry,
  zeroClearBytes,
} from './zero-knowledge';

export interface AetRowInput {
  kind: AetResourceKind;
  id: string;
  row: Record<string, unknown>;
}

export async function buildAetEnvelope(params: {
  mek: CryptoKey;
  rows: AetRowInput[];
  resources: AetEnvelope['resources'];
  etkSecret: Uint8Array;
}): Promise<{ envelope: AetEnvelope; included: number; skipped: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveAetWrappingKey(params.etkSecret, salt);
  const deks = {} as WrappedDekMap;
  let skipped = 0;

  for (const { kind, id, row } of params.rows.slice(0, AET_MAX_DEK_ENTRIES)) {
    const resourceKey = `${kind}:${id}` as AetResourceKey;
    const wrapped = getRowWrappedDek(row);
    if (!wrapped) {
      skipped++; // legacy MEK-direct Row: cannot be shared
      continue;
    }
    let dek: Uint8Array | null = null;
    try {
      dek = await unwrapRowDek(wrapped, params.mek);
      deks[resourceKey] = await wrapDekEntry(wrapKey, dek, resourceKey);
    } catch {
      skipped++;
    } finally {
      zeroClearBytes(dek);
    }
  }
  skipped += Math.max(0, params.rows.length - AET_MAX_DEK_ENTRIES);

  return {
    envelope: {
      v: 1,
      alg: 'AES-256-GCM',
      kdf: 'HKDF-SHA256',
      salt: bytesToBase64(salt),
      resources: params.resources,
      createdAt: new Date().toISOString(),
      deks,
    },
    included: Object.keys(deks).length,
    skipped,
  };
}

/**
 * Loads the vault Rows the user may permit for this agent key, using the same
 * data layer as the vault pages. Workspace-scoped mints include only Rows
 * linked to that workspace; otherwise only personal Rows.
 */
export async function loadPermittedRows(params: {
  userId: string;
  permittedVault: boolean;
  permittedTotp: boolean;
  permittedNotes?: boolean;
  isWorkspace?: boolean;
  workspaceId?: string | null;
}): Promise<AetRowInput[]> {
  const rows: AetRowInput[] = [];
  const { VaultService } = await import('@/lib/data');

  if (params.permittedVault) {
    const creds = await VaultService.listAllCredentials(params.userId).catch(() => [] as any[]);
    for (const r of creds || []) {
      rows.push({ kind: 'credential', id: String(r.$id || r.id), row: r });
    }
  }
  if (params.permittedTotp) {
    const totps = await VaultService.listTOTPSecrets(params.userId).catch(() => [] as any[]);
    for (const r of totps || []) {
      rows.push({ kind: 'totp', id: String(r.$id || r.id), row: r });
    }
  }
  // Notes are not offered until the locked-note ciphertext format is verified
  // against decryptRowField (see AET spec §4 #301).

  if (params.isWorkspace && params.workspaceId) {
    return rows.filter(
      ({ row }) =>
        row.isWorkspace === true ||
        row.projectId === params.workspaceId ||
        row.workspaceId === params.workspaceId
    );
  }
  return rows.filter(({ row }) => !row.isWorkspace && !row.projectId && !row.workspaceId);
}
