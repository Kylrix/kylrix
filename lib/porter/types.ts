/** Ecosystem-wide import/export (Porter) shared types. */

export type PorterFormat =
  | 'kylrix-vault'
  | 'kylrix-workspace'
  | 'bitwarden'
  | 'aegis'
  | 'otpauth-list'
  | 'csv-credentials'
  | 'csv-mixed'
  | 'env-bundle'
  | 'unknown';

export type PorterKind = 'credential' | 'totp' | 'workspace' | 'env';

export type PorterDraftDirection = 'import' | 'export';
export type PorterDraftDataKind = 'secrets' | 'totp' | 'mixed' | 'auto';

export interface PorterCredentialDraft {
  kind: 'credential';
  name: string;
  username?: string | null;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  totpUri?: string | null;
  customFields?: Array<{ label: string; value: string }>;
  isEnv?: boolean;
  itemType?: string;
  tags?: string[];
  /** Original vault row id — kept for re-import dedupe */
  sourceId?: string;
  _status?: 'new' | 'duplicate' | 'merged' | 'invalid';
  _skipReason?: string;
  _sourceHint?: string;
  /** User disputed skip — import anyway */
  _forceImport?: boolean;
  /** Existing vault row to update when merging a richer copy */
  _mergeTargetId?: string;
}

export interface PorterTotpDraft {
  kind: 'totp';
  secretKey: string;
  issuer: string;
  accountName: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  /** Original vault row id — kept for re-import dedupe */
  sourceId?: string;
  _status?: 'new' | 'duplicate' | 'merged' | 'invalid';
  _skipReason?: string;
  _sourceHint?: string;
  /** User disputed skip — import anyway */
  _forceImport?: boolean;
  /** Existing vault row to update when merging a richer copy */
  _mergeTargetId?: string;
}

/** Named workspace grouping in Transfer payloads (replaces legacy “folder”). */
export interface PorterWorkspaceDraft {
  kind: 'workspace';
  name: string;
  sourceId?: string;
  _sourceHint?: string;
}

/** @deprecated Prefer PorterWorkspaceDraft */
export type PorterFolderDraft = PorterWorkspaceDraft;

export interface PorterDiscernResult {
  format: PorterFormat;
  confidence: number; // 0–1
  label: string;
  summary: string;
  credentials: PorterCredentialDraft[];
  totpSecrets: PorterTotpDraft[];
  workspaces: PorterWorkspaceDraft[];
  warnings: string[];
  rawMeta?: Record<string, unknown>;
}

export interface PorterImportBundle {
  version: 2;
  format: 'kylrix-vault';
  credentials: PorterCredentialDraft[];
  totpSecrets: PorterTotpDraft[];
  workspaces: PorterWorkspaceDraft[];
  discernedFrom: PorterFormat;
  discernedAt: string;
}
