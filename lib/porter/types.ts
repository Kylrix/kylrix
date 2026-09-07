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

export type PorterKind = 'credential' | 'totp' | 'folder' | 'env';

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
}

export interface PorterFolderDraft {
  kind: 'folder';
  name: string;
  _sourceHint?: string;
}

export interface PorterDiscernResult {
  format: PorterFormat;
  confidence: number; // 0–1
  label: string;
  summary: string;
  credentials: PorterCredentialDraft[];
  totpSecrets: PorterTotpDraft[];
  folders: PorterFolderDraft[];
  warnings: string[];
  rawMeta?: Record<string, unknown>;
}

export interface PorterImportBundle {
  version: 2;
  format: 'kylrix-vault';
  credentials: PorterCredentialDraft[];
  totpSecrets: PorterTotpDraft[];
  folders: PorterFolderDraft[];
  discernedFrom: PorterFormat;
  discernedAt: string;
}
