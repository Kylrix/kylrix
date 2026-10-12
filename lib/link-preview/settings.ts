import { LocalEngine } from '@/lib/services/LocalEngine';
import { getSettings, updateSettings, createSettings } from '@/lib/appwrite/note';

const DISABLE_KEY = 'kylrix_disable_link_previews';

export function disablePreviewsCacheKey(userId: string): string {
  return `f_disable_link_previews_${userId}`;
}

export async function getDisablePreviews(userId: string): Promise<boolean> {
  if (!userId || userId === 'guest') {
    const local = await LocalEngine.cacheGet<boolean>(DISABLE_KEY).catch(() => null);
    return Boolean(local);
  }
  // RxDB first (offline-first)
  const local = await LocalEngine.cacheGet<boolean>(disablePreviewsCacheKey(userId)).catch(() => null);
  if (typeof local === 'boolean') return local;
  try {
    const row = await getSettings(userId);
    const cfg = row?.settings ? JSON.parse(row.settings) : {};
    const v = Boolean(cfg.disableLinkPreviews);
    // warm local copy
    await LocalEngine.cacheSet(disablePreviewsCacheKey(userId), v).catch(() => {});
    await LocalEngine.cacheSet(DISABLE_KEY, v).catch(() => {});
    return v;
  } catch {
    return Boolean(local);
  }
}

export async function setDisablePreviews(userId: string, disabled: boolean): Promise<void> {
  const key = userId && userId !== 'guest' ? disablePreviewsCacheKey(userId) : DISABLE_KEY;
  await LocalEngine.cacheSet(key, disabled).catch(() => {});
  await LocalEngine.cacheSet(DISABLE_KEY, disabled).catch(() => {});
  // also update generic key for offline first
  if (userId && userId !== 'guest') {
    try {
      const row = await getSettings(userId).catch(() => null);
      let cfg: any = {};
      if (row?.settings) {
        try { cfg = JSON.parse(row.settings); } catch { cfg = {}; }
      }
      cfg.disableLinkPreviews = disabled;
      const payload = { settings: JSON.stringify(cfg) };
      try {
        await updateSettings(userId, payload);
      } catch {
        await createSettings({ userId, settings: payload.settings });
      }
    } catch {
      // offline — local copy already set, will sync on next online via settings sync
    }
  }
  // broadcast for markdown pipeline
  if (typeof window !== 'undefined') {
    (window as any).__KylrixDisableLinkPreviews = disabled;
    window.dispatchEvent(new CustomEvent('kylrix:disable-previews-changed', { detail: { disabled } }));
  }
}

// Sync getter for markdown pipeline (sync read)
export function getDisablePreviewsSync(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__KylrixDisableLinkPreviews);
}

// Hydrate on app start
if (typeof window !== 'undefined') {
  void (async () => {
    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const v = await LocalEngine.cacheGet<boolean>(DISABLE_KEY).catch(() => null);
      if (typeof v === 'boolean') (window as any).__KylrixDisableLinkPreviews = v;
      // also try user-specific if available via account
      try {
        const { getCurrentUserSnapshot } = await import('@/lib/appwrite/client');
        const u = getCurrentUserSnapshot();
        if (u?.$id) {
          const uv = await LocalEngine.cacheGet<boolean>(disablePreviewsCacheKey(u.$id)).catch(() => null);
          if (typeof uv === 'boolean') (window as any).__KylrixDisableLinkPreviews = uv;
        }
      } catch {}
    } catch {}
  })();
}
