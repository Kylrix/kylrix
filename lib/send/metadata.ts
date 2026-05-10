import type { SendKind } from './types';

const SEND_KINDS = new Set<string>(['note', 'password', 'totp', 'task', 'file']);

/** Parsed note.metadata for Send ghost rows (and compatible with classic ghost notes). */
export interface SendGhostNoteMetadata {
  isGhost?: boolean;
  /** Send variant; absent on classic ghost landing notes. */
  /** schemaVersion/bumped shapes reserved for Note/Vault/Flow claim pipelines */
  send_object?: { kind: SendKind; bucketId?: string; fileId?: string; schemaVersion?: number };
  /** SHA-256 hex of creator-held deletion secret (optional on legacy rows). */
  creatorDeletionProofHash?: string;
  ghostSecret?: string;
  expiresAt?: string;
  version?: string;
  isEncrypted?: boolean;
}

export function parseSendGhostMetadata(metadataJson: string | undefined | null): SendGhostNoteMetadata {
  try {
    return JSON.parse(metadataJson || '{}') as SendGhostNoteMetadata;
  } catch {
    return {};
  }
}

export function isSendObjectMeta(meta: SendGhostNoteMetadata): meta is SendGhostNoteMetadata & { send_object: { kind: SendKind } } {
  const k = meta.send_object?.kind;
  return typeof k === 'string' && SEND_KINDS.has(k);
}
