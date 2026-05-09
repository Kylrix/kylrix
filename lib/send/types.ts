export type SendKind = 'note' | 'password' | 'task' | 'totp' | 'file';

export interface SendExpiryPreset {
  id: string;
  label: string;
  ms: number;
}

export interface SendDraftPayload {
  kind: SendKind;
  expiresAtMs: number;
  /** Client-only preview until persistence ships */
  title?: string;
  body?: string;
  password?: string;
  username?: string;
  taskTitle?: string;
  taskDetail?: string;
  totpSecret?: string;
  totpIssuer?: string;
  fileName?: string;
}
