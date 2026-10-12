import crypto from 'crypto';

export type PasswordGenerationType = 'strong' | 'alphanumeric' | 'digits' | 'pin';

export interface GenerateSecretOptions {
  length?: number;
  type?: PasswordGenerationType;
  charset?: string;
}

const CHARSETS: Record<string, string> = {
  digits: '0123456789',
  pin: '0123456789',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  strong: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>?',
};

export function looksEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 24) return false;
  return /^[A-Za-z0-9+/=]+$/.test(trimmed);
}

/**
 * Generate cryptographically secure random password or PIN
 */
export function generateRandomVaultSecret(options: GenerateSecretOptions = {}): string {
  const type = options.type || 'strong';
  let defaultLen = 20;
  if (type === 'pin') defaultLen = 6;
  if (type === 'digits') defaultLen = 8;
  
  const length = Math.max(4, Math.min(128, options.length || defaultLen));
  const chars = options.charset || CHARSETS[type] || CHARSETS.strong;
  
  const charCount = chars.length;
  const maxValidByte = 256 - (256 % charCount);
  let result = '';
  
  while (result.length < length) {
    const bytes = crypto.randomBytes(length * 2);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const b = bytes[i];
      if (b < maxValidByte) {
        result += chars[b % charCount];
      }
    }
  }
  
  return result;
}

/**
 * Parse MEK from 64-hex char string, base64, or raw string into 32-byte Uint8Array
 */
export function parseMekToBytes(mekInput: string): Uint8Array {
  const trimmed = mekInput.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return new Uint8Array(Buffer.from(trimmed, 'hex'));
  }
  if (/^[A-Za-z0-9+/=]{40,48}$/.test(trimmed)) {
    try {
      const buf = Buffer.from(trimmed, 'base64');
      if (buf.length === 32) return new Uint8Array(buf);
    } catch {}
  }
  return new Uint8Array(crypto.createHash('sha256').update(trimmed).digest());
}

/**
 * Convert MEK bytes to WebCrypto CryptoKey
 */
export async function importMekCryptoKey(mekBytes: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    mekBytes as any,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM and prepended 16-byte IV (Base64 result)
 */
export async function encryptFieldWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  const combined = new Uint8Array(16 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 16);
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt base64 (16-byte IV + ciphertext+tag) using AES-256-GCM
 */
export async function decryptFieldWithKey(ciphertextBase64: string, key: CryptoKey): Promise<string> {
  const combined = Buffer.from(ciphertextBase64, 'base64');
  if (combined.length < 17) {
    throw new Error('Ciphertext too short for AES-GCM decryption');
  }
  const iv = combined.subarray(0, 16);
  const data = combined.subarray(16);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt a vault field with a new or existing DEK wrapped with the supplied MEK
 */
export async function sealVaultSecret(
  plaintext: string,
  mekBytes: Uint8Array,
  existingWrappedDek?: string | null
): Promise<{ encrypted: string; wrappedDek: string }> {
  const mekKey = await importMekCryptoKey(mekBytes);
  let dekKey: CryptoKey;
  let wrappedDek: string;

  if (existingWrappedDek && existingWrappedDek.trim().length > 0) {
    wrappedDek = existingWrappedDek.trim();
    try {
      const rawDekBase64 = await decryptFieldWithKey(wrappedDek, mekKey);
      const rawDek = Buffer.from(rawDekBase64, 'base64');
      dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawDek as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      // If unwrap fails, generate fresh DEK
      const freshDekBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
      dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        freshDekBytes as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      wrappedDek = await encryptFieldWithKey(Buffer.from(freshDekBytes).toString('base64'), mekKey);
    }
  } else {
    const freshDekBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    dekKey = await globalThis.crypto.subtle.importKey(
      'raw',
      freshDekBytes as any,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    wrappedDek = await encryptFieldWithKey(Buffer.from(freshDekBytes).toString('base64'), mekKey);
  }

  const encrypted = await encryptFieldWithKey(plaintext, dekKey);
  return { encrypted, wrappedDek };
}

export const VAULT_ENCRYPTED_FIELDS = {
  credentials: [
    'name',
    'url',
    'username',
    'password',
    'notes',
    'customFields',
    'cardNumber',
    'cardholderName',
    'cardExpiry',
    'cardCVV',
    'cardPIN',
  ] as const,
  totpSecrets: [
    'issuer',
    'accountName',
    'secretKey',
    'url',
  ] as const,
};

/**
 * Seals multiple record fields using a single wrapped DEK and MEK
 */
export async function sealRowFields(
  data: Record<string, any>,
  fieldsToEncrypt: readonly string[],
  mekBytes: Uint8Array,
  existingWrappedDek?: string | null
): Promise<{ encryptedFields: Record<string, string | null>; wrappedDek: string }> {
  const mekKey = await importMekCryptoKey(mekBytes);
  let dekKey: CryptoKey;
  let wrappedDek: string;

  if (existingWrappedDek && existingWrappedDek.trim().length > 0) {
    wrappedDek = existingWrappedDek.trim();
    try {
      const rawDekBase64 = await decryptFieldWithKey(wrappedDek, mekKey);
      const rawDek = Buffer.from(rawDekBase64, 'base64');
      dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawDek as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      const freshDekBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
      dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        freshDekBytes as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      wrappedDek = await encryptFieldWithKey(Buffer.from(freshDekBytes).toString('base64'), mekKey);
    }
  } else {
    const freshDekBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    dekKey = await globalThis.crypto.subtle.importKey(
      'raw',
      freshDekBytes as any,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    wrappedDek = await encryptFieldWithKey(Buffer.from(freshDekBytes).toString('base64'), mekKey);
  }

  const encryptedFields: Record<string, string | null> = {};
  for (const field of fieldsToEncrypt) {
    const val = data[field];
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      encryptedFields[field] = await encryptFieldWithKey(strVal, dekKey);
    } else if (val === null || val === '') {
      encryptedFields[field] = null;
    }
  }

  return { encryptedFields, wrappedDek };
}

/**
 * Unseals / decrypts record fields using wrapped DEK and MEK
 */
export async function unsealRowFields(
  row: Record<string, any>,
  fieldsToDecrypt: readonly string[],
  mekBytes: Uint8Array
): Promise<Record<string, any>> {
  const mekKey = await importMekCryptoKey(mekBytes);
  const wrappedDek = row.dek;
  let dekKey: CryptoKey | null = null;

  if (wrappedDek && typeof wrappedDek === 'string' && wrappedDek.trim().length > 0) {
    try {
      const rawDekBase64 = await decryptFieldWithKey(wrappedDek.trim(), mekKey);
      const rawDek = Buffer.from(rawDekBase64, 'base64');
      dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawDek as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['decrypt']
      );
    } catch {}
  }

  const result: Record<string, any> = {};
  for (const field of fieldsToDecrypt) {
    const val = row[field];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      try {
        if (dekKey) {
          result[field] = await decryptFieldWithKey(val, dekKey);
        } else {
          result[field] = await decryptFieldWithKey(val, mekKey);
        }
      } catch {
        result[field] = val;
      }
    } else {
      result[field] = val ?? null;
    }
  }

  return result;
}

/**
 * Unseal / decrypt a vault secret using wrapped DEK and MEK
 */
export async function unsealVaultSecret(
  ciphertextBase64: string,
  wrappedDek: string | null | undefined,
  mekBytes: Uint8Array
): Promise<string> {
  const mekKey = await importMekCryptoKey(mekBytes);

  if (wrappedDek && wrappedDek.trim().length > 0) {
    try {
      const rawDekBase64 = await decryptFieldWithKey(wrappedDek, mekKey);
      const rawDek = Buffer.from(rawDekBase64, 'base64');
      const dekKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawDek as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      return await decryptFieldWithKey(ciphertextBase64, dekKey);
    } catch {
      // Fallback: try decrypting directly with MEK
      return await decryptFieldWithKey(ciphertextBase64, mekKey);
    }
  }

  // Direct MEK decryption fallback
  return await decryptFieldWithKey(ciphertextBase64, mekKey);
}

/**
 * Parse any key (hex, url-safe base64, standard base64, raw) into 32-byte or raw Uint8Array
 */
export function parseKeyToBytes(keyInput: string): Uint8Array {
  const trimmed = keyInput.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return new Uint8Array(Buffer.from(trimmed, 'hex'));
  }
  const base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const buf = Buffer.from(padded, 'base64');
    if (buf.length > 0) return new Uint8Array(buf);
  } catch {}
  return parseMekToBytes(trimmed);
}

/**
 * Derive user MEK from master password and keychain entry (Argon2id or PBKDF2)
 */
export async function deriveMekFromMasterPassword(params: {
  password: string;
  salt: string;
  wrappedKey: string;
  params?: any;
  isArgon?: boolean;
}): Promise<Uint8Array | null> {
  if (!params.password || !params.salt || !params.wrappedKey) return null;

  let saltBytes: Uint8Array;
  const rawSalt = params.salt.trim();
  if (/^[0-9a-fA-F]{32,64}$/.test(rawSalt)) {
    saltBytes = new Uint8Array(Buffer.from(rawSalt, 'hex'));
  } else {
    try {
      const base64Salt = rawSalt.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64Salt + '='.repeat((4 - (base64Salt.length % 4)) % 4);
      saltBytes = new Uint8Array(Buffer.from(padded, 'base64'));
    } catch {
      saltBytes = new TextEncoder().encode(rawSalt);
    }
  }

  const isArgonBySalt = saltBytes.length === 32;
  const isArgonByParam = typeof params.params === 'string'
    ? params.params.includes('Argon2id')
    : (params.params?.algo === 'Argon2id' || !!params.params?.memory);
  const isArgon = Boolean(params.isArgon || isArgonBySalt || isArgonByParam);

  const wrappedKeyBytes = parseKeyToBytes(params.wrappedKey);
  if (wrappedKeyBytes.length <= 16) return null;

  const iv = wrappedKeyBytes.slice(0, 16);
  const ciphertext = wrappedKeyBytes.slice(16);

  // 1. Try Argon2id derivation
  if (isArgon) {
    try {
      const { argon2id } = await import('hash-wasm');
      const hash = await argon2id({
        password: params.password,
        salt: saltBytes,
        parallelism: 4,
        iterations: 3,
        memorySize: 65536,
        hashLength: 32,
        outputType: 'binary',
      });

      const authKey = await globalThis.crypto.subtle.importKey(
        'raw',
        hash as any,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        authKey,
        ciphertext
      );
      return new Uint8Array(decrypted);
    } catch (_argonErr) {
      // Fall through to PBKDF2 attempt
    }
  }

  // 2. PBKDF2 fallback
  try {
    const enc = new TextEncoder();
    const baseKey = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(params.password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes as any,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      256
    );

    const authKey = await globalThis.crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      authKey,
      ciphertext
    );
    return new Uint8Array(decrypted);
  } catch (_pbkdf2Err) {
    return null;
  }
}

/**
 * Flexible unsealing helper for Public or Authenticated secrets.
 * Handles direct DEK (share links), MEK, or Master Password.
 */
export async function unsealRowWithAnyKey(
  row: Record<string, any>,
  fieldsToDecrypt: readonly string[],
  opts: {
    shareKey?: string | null;
    mek?: string | null;
    mekBytes?: Uint8Array | null;
  }
): Promise<{ unsealed: Record<string, any>; keyUsed: 'dek' | 'mek' | null }> {
  const result: Record<string, any> = {};

  // 1. Direct MEK Bytes provided
  if (opts.mekBytes) {
    const unsealed = await unsealRowFields(row, fieldsToDecrypt, opts.mekBytes);
    return { unsealed, keyUsed: 'mek' };
  }

  // 2. Share Key or MEK string provided
  const candidateKeyStr = opts.shareKey || opts.mek;
  if (!candidateKeyStr || !candidateKeyStr.trim()) {
    return { unsealed: {}, keyUsed: null };
  }

  const keyBytes = parseKeyToBytes(candidateKeyStr);

  // Attempt A: Treat candidate key as direct DEK (e.g. from /vault/:id/:dek share link)
  try {
    const directDekKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as any,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );

    let successCount = 0;
    for (const field of fieldsToDecrypt) {
      const val = row[field];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        try {
          result[field] = await decryptFieldWithKey(val, directDekKey);
          successCount++;
        } catch {
          result[field] = val;
        }
      } else {
        result[field] = val ?? null;
      }
    }

    if (successCount > 0) {
      return { unsealed: result, keyUsed: 'dek' };
    }
  } catch {}

  // Attempt B: Treat candidate key as MEK (unwrap row.dek with MEK, then decrypt)
  try {
    const unsealed = await unsealRowFields(row, fieldsToDecrypt, keyBytes);
    const hasDecrypted = Object.values(unsealed).some(
      (v) => typeof v === 'string' && !looksEncrypted(v)
    );
    if (hasDecrypted) {
      return { unsealed, keyUsed: 'mek' };
    }
  } catch {}

  return { unsealed: {}, keyUsed: null };
}

/**
 * Formats custom fields or secret fields into standardized .env format string
 */
export function formatVaultSecretToEnv(
  unsealed: Record<string, any>,
  opts?: { pure?: boolean; fallbackTitle?: string }
): string {
  const lines: string[] = [];

  // 1. Check customFields (JSON array or object)
  if (unsealed.customFields) {
    try {
      const raw = typeof unsealed.customFields === 'string'
        ? JSON.parse(unsealed.customFields)
        : unsealed.customFields;

      if (Array.isArray(raw)) {
        for (const f of raw) {
          const key = String(f.label || f.key || f.name || '').trim();
          const val = String(f.value ?? '');
          if (key) {
            lines.push(formatEnvLine(key, val));
          }
        }
      } else if (raw && typeof raw === 'object') {
        for (const [key, val] of Object.entries(raw)) {
          if (key.trim()) {
            lines.push(formatEnvLine(key.trim(), String(val ?? '')));
          }
        }
      }
    } catch {}
  }

  // 2. Check notes for embedded KEY=VALUE pairs
  if (unsealed.notes && typeof unsealed.notes === 'string') {
    const noteLines = unsealed.notes.split(/\r?\n/);
    for (const line of noteLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        lines.push(formatEnvLine(key, val));
      }
    }
  }

  // 3. Fallback: single password/secret value
  if (lines.length === 0 && unsealed.password) {
    const rawTitle = unsealed.name || opts?.fallbackTitle || 'SECRET';
    const key = rawTitle.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'SECRET';
    lines.push(formatEnvLine(key, String(unsealed.password)));
  }

  return lines.join('\n');
}

function formatEnvLine(key: string, val: string): string {
  let cleanVal = val;
  if (
    (cleanVal.includes(' ') || cleanVal.includes('\n') || cleanVal.includes('#') || cleanVal.includes('=')) &&
    !((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'")))
  ) {
    cleanVal = `"${cleanVal.replace(/"/g, '\\"')}"`;
  }
  return `${key}=${cleanVal}`;
}

