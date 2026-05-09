import type { SendExpiryPreset } from './types';

/** Hard cap for Send links (matches product rule). */
export const SEND_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Future TablesDB fields on NOTE rows for Send objects (UI-only phase).
 * Keeps Send payloads indexable for TTL sweeps and excludes them from default note listings.
 */
export const SEND_NOTE_ROW_KEYS = {
  kind: 'kylrix_send_kind',
  expiresAt: 'kylrix_send_expires_at',
  /** Schema version for encrypted payload blobs */
  payloadVersion: 'kylrix_send_v',
} as const;

export const SEND_EXPIRY_PRESETS: SendExpiryPreset[] = [
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: SEND_MAX_TTL_MS },
];

export function clampExpiryMs(ms: number): number {
  return Math.min(Math.max(ms, 60 * 1000), SEND_MAX_TTL_MS);
}
