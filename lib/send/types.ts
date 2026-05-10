export type SendKind = 'note' | 'password' | 'totp' | 'task' | 'file';

export interface SendExpiryPreset {
  id: string;
  label: string;
  ms: number;
}

/** Encrypted JSON inside ghost note `content` after decryption (password + optional bundled TOTP). */
export interface SendPasswordPayload {
  username?: string;
  password: string;
  /** Optional authenticator seed shipped with the password */
  totpSecret?: string;
}

export interface SendTotpPayload {
  issuer?: string;
  account?: string;
  secret: string;
}

export interface SendTaskPayload {
  title: string;
  detail?: string;
  /** ISO datetime string */
  dueAt?: string;
}

export interface SendDraftPayload {
  kind: SendKind;
  expiresAtMs: number;
  title?: string;
  body?: string;
  username?: string;
  password?: string;
  taskTitle?: string;
  taskDetail?: string;
  totpIssuer?: string;
  totpSecret?: string;
  fileName?: string;
}
