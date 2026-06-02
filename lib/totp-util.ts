import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';

/**
 * Internal light-weight TOTP utilities.
 * Bypasses heavy dependencies like otplib and speakeasy.
 */

function base32ToBuffer(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/=+$/, '').toUpperCase();
  const len = clean.length;
  const buffer = new Uint8Array(Math.floor((len * 5) / 8));
  
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < len; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

/**
 * Generates a 6-digit TOTP code.
 */
export function generateTOTP(secret: string, options: { step?: number; digits?: number; timestamp?: number } = {}): string {
    const step = options.step || 30;
    const digits = options.digits || 6;
    const ts = options.timestamp || Date.now();
    const counter = Math.floor(ts / 1000 / step);
    
    // Counter to 8-byte buffer (big-endian)
    const counterBuf = new Uint8Array(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
        counterBuf[i] = tmp & 0xff;
        tmp >>>= 8;
    }

    const key = base32ToBuffer(secret);
    const hmacRes = hmac(sha1, key, counterBuf);
    
    const offset = hmacRes[hmacRes.length - 1] & 0xf;
    const binary = ((hmacRes[offset] & 0x7f) << 24) |
                   ((hmacRes[offset + 1] & 0xff) << 16) |
                   ((hmacRes[offset + 2] & 0xff) << 8) |
                   (hmacRes[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
}

/**
 * Validates a TOTP code with a window for clock drift.
 */
export function verifyTOTP(token: string, secret: string, options: { window?: number; step?: number } = {}): boolean {
    const win = options.window || 1;
    const step = options.step || 30;
    const now = Date.now();

    for (let i = -win; i <= win; i++) {
        const time = now + (i * step * 1000);
        if (generateTOTP(secret, { step, timestamp: time }) === token) return true;
    }
    return false;
}
