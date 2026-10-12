import { createHash, timingSafeEqual } from 'node:crypto';

function sha(buf: string) {
  return createHash('sha256').update(buf, 'utf8').digest();
}

/** Compare configured secret vs presented token without leaking length via substring timing (hashed SHA-256 equality). */
export function timingSafeBearerMatchesConfiguredSecret(candidate: string | null | undefined): boolean {
  const secret = process.env.KYLRIX_INTERNAL_JOBS_SECRET;
  if (!secret || secret.length < 32) return false;
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return false;
  try {
    const hA = sha(secret);
    const hB = sha(trimmed);
    return timingSafeEqual(hA, hB);
  } catch {
    return false;
  }
}

export function internalJobsConfigured(): boolean {
  return !!process.env.KYLRIX_INTERNAL_JOBS_SECRET && process.env.KYLRIX_INTERNAL_JOBS_SECRET!.length >= 32;
}

export function readJobsBearer(headerAuth: string | null, headerDedicated: string | null): string | null {
  const a = headerAuth?.trim();
  if (a?.toLowerCase().startsWith('bearer ')) {
    return a.slice(7).trim() || null;
  }
  const d = headerDedicated?.trim();
  return d || null;
}
