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
