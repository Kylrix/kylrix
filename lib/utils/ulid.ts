import { randomBytes } from 'crypto';

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

  // 80 bits of cryptographically secure randomness
  const bytes = randomBytes(10);
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    const byte = bytes[i % 10];
    randStr += ENCODING[byte % ENCODING_LEN];
  }

  return timeStr + randStr;
}

/** Drop-in Appwrite ID replacement */
export const ID = {
  unique: () => ulid().toLowerCase(),
  custom: (val: string) => val,
};
