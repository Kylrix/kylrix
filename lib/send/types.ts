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

/** Plaintext manifest stored in encrypted ghost `content` — ciphertext bytes live in Storage. */
export interface SendFilePayload {
  bucketId: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
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
