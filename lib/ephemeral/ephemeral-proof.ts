import { createHash, timingSafeEqual } from 'crypto';

/** Server-side SHA-256 → hex for ephemeral creator proofs (delete / consume). */
export function sha256HexUtf8(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

export function timingSafeHexEqual(expectedHex: string, computedHex: string): boolean {
  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(computedHex, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyCreatorDeletionProof(meta: Record<string, unknown>, secret: string): boolean {
  const expectedHash = String(meta.creatorDeletionProofHash || '').trim().toLowerCase();
  if (!expectedHash) return false;
  const computed = sha256HexUtf8(secret).toLowerCase();
  return timingSafeHexEqual(expectedHash, computed);
}
