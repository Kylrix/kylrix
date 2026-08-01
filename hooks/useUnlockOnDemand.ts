'use client';

import { useCallback, useEffect, useState } from 'react';
import { account } from '@/lib/appwrite/client';
import {
  UNLOCK_ON_DEMAND_DEFAULT,
  UNLOCK_ON_DEMAND_PREF_KEY,
  isUnlockOnDemandEnabled,
} from '@/lib/security/unlock-on-demand';

const EVENT = 'kylrix:unlock-on-demand-changed';

export function useUnlockOnDemand() {
  const [enabled, setEnabled] = useState(UNLOCK_ON_DEMAND_DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const prefs = (await account.getPrefs().catch(() => ({}))) as Record<string, unknown>;
      setEnabled(isUnlockOnDemandEnabled(prefs));
    } catch {
      setEnabled(UNLOCK_ON_DEMAND_DEFAULT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(EVENT, onChanged);
    return () => window.removeEventListener(EVENT, onChanged);
  }, [refresh]);

  const setUnlockOnDemand = useCallback(async (next: boolean) => {
    setEnabled(next);
    try {
      const prefs = (await account.getPrefs().catch(() => ({}))) as Record<string, unknown>;
      await account.updatePrefs({ ...prefs, [UNLOCK_ON_DEMAND_PREF_KEY]: next });
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { enabled: next } }));
    } catch (err) {
      await refresh();
      throw err;
    }
  }, [refresh]);

  return { unlockOnDemand: enabled, loading, setUnlockOnDemand, refresh };
}
