import * as crypto from 'node:crypto';

/**
 * Clean Base32 decoder for OTP secrets.
 */
function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[\s=-]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code and remaining seconds in window.
 */
export function generateTotp(secret: string, periodSeconds = 30, digits = 6): { code: string; remainingSeconds: number } {
  const key = base32Decode(secret);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(nowSeconds / periodSeconds);
  const remainingSeconds = periodSeconds - (nowSeconds % periodSeconds);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  const code = String(otp).padStart(digits, '0');

  return { code, remainingSeconds };
}
