import type { SendExpiryPreset } from './types';

/** Hard cap for Send links (matches product rule). */
export const SEND_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SEND_EXPIRY_PRESETS: SendExpiryPreset[] = [
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: SEND_MAX_TTL_MS },
];

export function clampExpiryMs(ms: number): number {
  return Math.min(Math.max(ms, 60 * 1000), SEND_MAX_TTL_MS);
}
