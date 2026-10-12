import crypto from 'crypto';

/**
 * Retrieves the server-side KYLRIX_MEK as a 32-byte Buffer.
 * Supports 64-hex chars or 44-base64 chars, with a deterministic fallback for dev environments.
 */
function getKylrixMekBuffer(): Buffer {
  const raw = process.env.KYLRIX_MEK;
  if (!raw) {
    // In strict production, this can throw or use a fallback derived from process.env.APPWRITE_API_KEY
    if (process.env.NODE_ENV === 'production') {
      const fallbackSecret = process.env.APPWRITE_API_KEY || 'kylrix-production-master-encryption-key-fallback';
      return crypto.createHash('sha256').update(fallbackSecret).digest();
    }
    return crypto.createHash('sha256').update('kylrix-dev-master-encryption-key-local-only').digest();
  }

  const clean = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return Buffer.from(clean, 'hex');
  }
  if (clean.length === 44 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
    return Buffer.from(clean, 'base64');
  }
  return crypto.createHash('sha256').update(clean).digest();
}

/**
 * Encrypts arbitrary plaintext using server KYLRIX_MEK (AES-256-GCM).
 * Returns `aes-gcm:<iv_base64>:<tag_base64>:<ciphertext_base64>`.
 */
export function encryptWithKylrixMek(plaintext: string): string {
  if (!plaintext) return '';
  const key = getKylrixMekBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return `aes-gcm:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts envelope encrypted with server KYLRIX_MEK.
 */
export function decryptWithKylrixMek(envelope: string): string {
  if (!envelope) return '';
  if (!envelope.startsWith('aes-gcm:')) {
    throw new Error('Invalid KYLRIX_MEK envelope format');
  }

  const parts = envelope.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed KYLRIX_MEK envelope format');
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  const key = getKylrixMekBuffer();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
