/**
 * Remember Unlock — preference foundations only.
 *
 * NOT wired into ecosystemSecurity / sudo / master-pass flows yet.
 * Persists user intent (enabled + duration). Does not store or reuse keys.
 */

export const REMEMBER_UNLOCK_STORAGE_KEY = 'kylrix_remember_unlock_v1';

/** How long the user wants unlock remembered once this feature is connected. */
export type RememberUnlockDurationId =
  | '1h'
  | '8h'
  | '24h'
  | '7d'
  | 'custom';

export type RememberUnlockPrefs = {
  /** User opted in — warned as less safe in UI. */
  enabled: boolean;
  durationId: RememberUnlockDurationId;
  /** Used when durationId === 'custom'; hours, clamped 1–168 (1 week). */
  customHours: number;
  updatedAt: number;
};

export const REMEMBER_UNLOCK_DURATION_OPTIONS: Array<{
  id: RememberUnlockDurationId;
  label: string;
  hours: number | null;
}> = [
  { id: '1h', label: '1 hour', hours: 1 },
  { id: '8h', label: '8 hours', hours: 8 },
  { id: '24h', label: '24 hours', hours: 24 },
  { id: '7d', label: '1 week', hours: 24 * 7 },
  { id: 'custom', label: 'Custom', hours: null },
];

export const REMEMBER_UNLOCK_MAX_HOURS = 24 * 7;

export const DEFAULT_REMEMBER_UNLOCK_PREFS: RememberUnlockPrefs = {
  enabled: false,
  durationId: '24h',
  customHours: 24,
  updatedAt: 0,
};

export function resolveRememberUnlockHours(prefs: RememberUnlockPrefs): number {
  if (prefs.durationId === 'custom') {
    return Math.min(
      REMEMBER_UNLOCK_MAX_HOURS,
      Math.max(1, Math.floor(Number(prefs.customHours) || 1)),
    );
  }
  const match = REMEMBER_UNLOCK_DURATION_OPTIONS.find((o) => o.id === prefs.durationId);
  return match?.hours ?? 24;
}

export function readRememberUnlockPrefs(): RememberUnlockPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_REMEMBER_UNLOCK_PREFS };
  try {
    const raw = localStorage.getItem(REMEMBER_UNLOCK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REMEMBER_UNLOCK_PREFS };
    const parsed = JSON.parse(raw) as Partial<RememberUnlockPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      durationId:
        REMEMBER_UNLOCK_DURATION_OPTIONS.some((o) => o.id === parsed.durationId)
          ? (parsed.durationId as RememberUnlockDurationId)
          : DEFAULT_REMEMBER_UNLOCK_PREFS.durationId,
      customHours: Math.min(
        REMEMBER_UNLOCK_MAX_HOURS,
        Math.max(1, Number(parsed.customHours) || 24),
      ),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { ...DEFAULT_REMEMBER_UNLOCK_PREFS };
  }
}

export function writeRememberUnlockPrefs(
  patch: Partial<Omit<RememberUnlockPrefs, 'updatedAt'>>,
): RememberUnlockPrefs {
  const next: RememberUnlockPrefs = {
    ...readRememberUnlockPrefs(),
    ...patch,
    updatedAt: Date.now(),
  };
  next.customHours = Math.min(
    REMEMBER_UNLOCK_MAX_HOURS,
    Math.max(1, Math.floor(Number(next.customHours) || 1)),
  );
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REMEMBER_UNLOCK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}

/**
 * Placeholder for a future sealed unlock blob.
 * Intentionally a no-op until crypto wiring ships.
 */
export function clearRememberUnlockSeal(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('kylrix_remember_unlock_seal_v1');
  } catch {
    /* ignore */
  }
}
