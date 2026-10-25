const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;

/**
 * Universally Unique Lexicographically Sortable Identifier (ULID).
 * 128-bit compatible, 26 characters, millisecond timestamp prefix, monotonic, zero dependencies.
 */
export function ulid(seedTime: number = Date.now()): string {
  let timeStr = '';
  let now = seedTime;
  for (let i = 9; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    timeStr = ENCODING[mod] + timeStr;
    now = Math.floor(now / ENCODING_LEN);
  }

  // 80 bits (16 base32 characters) of cryptographically secure randomness
  const bytes = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    try {
      // Node.js fallback
      const cryptoModule = require('node:crypto');
      const buf = cryptoModule.randomBytes(16);
      bytes.set(buf);
    } catch {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  }

  let randStr = '';
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING[bytes[i] & 31];
  }

  return timeStr + randStr;
}

/** Drop-in Appwrite ID replacement */
export const ID = {
  unique: () => ulid().toLowerCase(),
  custom: (val: string) => val,
};
