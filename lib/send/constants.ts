import type { SendExpiryPreset } from './types';

/** Hard cap for Send links (matches product rule). */
export const SEND_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Device-local Send sparks — distinct from `kylrix_ghost_notes_v2` so ghost UX stays isolated. */
export const SEND_SPARK_STORAGE_KEY = 'kylrix_send_sparks_v1';

export const SEND_SPARKS_MAX = 15;

/** Plaintext upload cap in Send UI (20 MiB for Free, 100 MiB for PRO). Bucket allows 120 MiB headroom for ciphertext / encryption overhead — see appwrite.config.json `kylrix_send`. */
export const SEND_MAX_FILE_BYTES_FREE = 20 * 1024 * 1024;
export const SEND_MAX_FILE_BYTES_PRO = 100 * 1024 * 1024;

/** Legacy fallback constant; use dynamic checks where possible. */
export const SEND_MAX_FILE_BYTES = SEND_MAX_FILE_BYTES_FREE;

export const SEND_EXPIRY_PRESETS: SendExpiryPreset[] = [
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: SEND_MAX_TTL_MS },
];

export function clampExpiryMs(ms: number): number {
  return Math.min(Math.max(ms, 60 * 1000), SEND_MAX_TTL_MS);
}
