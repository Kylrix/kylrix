'use client';

import { LocalEngine } from '@/lib/services/LocalEngine';
import { account } from '@/lib/appwrite/client';

export type ConnectFeedSettings = {
  topics: string[];
  interests: string[];
  autoPreviewMedia: boolean;
  showNostr: boolean;
  showEcosystem: boolean;
  showReplies: boolean;
  showLikes: boolean;
  compactMode: boolean;
  autoPlayMedia: boolean;
};

const DEFAULTS: ConnectFeedSettings = {
  topics: [],
  interests: ['builders', 'nostr', 'kylrix'],
  autoPreviewMedia: true,
  showNostr: true,
  showEcosystem: true,
  showReplies: true,
  showLikes: true,
  compactMode: false,
  autoPlayMedia: false,
};

const LOCAL_KEY = 'kylrix_connect_feed_settings_v1';
const PREFS_KEY = 'connectFeedSettings';

function normalize(raw: any): ConnectFeedSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  return {
    topics: Array.isArray(raw.topics) ? raw.topics.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 20) : [...DEFAULTS.topics],
    interests: Array.isArray(raw.interests) ? raw.interests.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 20) : [...DEFAULTS.interests],
    autoPreviewMedia: typeof raw.autoPreviewMedia === 'boolean' ? raw.autoPreviewMedia : DEFAULTS.autoPreviewMedia,
    showNostr: typeof raw.showNostr === 'boolean' ? raw.showNostr : DEFAULTS.showNostr,
    showEcosystem: typeof raw.showEcosystem === 'boolean' ? raw.showEcosystem : DEFAULTS.showEcosystem,
    showReplies: typeof raw.showReplies === 'boolean' ? raw.showReplies : DEFAULTS.showReplies,
    showLikes: typeof raw.showLikes === 'boolean' ? raw.showLikes : DEFAULTS.showLikes,
    compactMode: typeof raw.compactMode === 'boolean' ? raw.compactMode : DEFAULTS.compactMode,
    autoPlayMedia: typeof raw.autoPlayMedia === 'boolean' ? raw.autoPlayMedia : DEFAULTS.autoPlayMedia,
  };
}

export async function getConnectFeedSettings(): Promise<ConnectFeedSettings> {
  try {
    const local = await LocalEngine.cacheGet<any>(LOCAL_KEY).catch(() => null);
    if (local) return normalize(local);
  } catch {}
  try {
    const user = await account.get().catch(() => null as any);
    const prefsRaw = (user as any)?.prefs?.[PREFS_KEY];
    if (prefsRaw) {
      const parsed = typeof prefsRaw === 'string' ? JSON.parse(prefsRaw) : prefsRaw;
      return normalize(parsed);
    }
  } catch {}
  return { ...DEFAULTS };
}

export async function setConnectFeedSettings(next: Partial<ConnectFeedSettings>): Promise<ConnectFeedSettings> {
  const current = await getConnectFeedSettings();
  const merged = normalize({ ...current, ...next });
  try {
    await LocalEngine.cacheSet(LOCAL_KEY, merged);
    if (typeof window !== 'undefined') {
      (window as any).__KylrixConnectFeedSettings = merged;
      window.dispatchEvent(new CustomEvent('kylrix-connect-feed-settings', { detail: merged }));
    }
  } catch {}
  // Sync to user live settings (prefs) debounced
  try {
    const user = await account.get().catch(() => null as any);
    if (user) {
      const currentPrefs = (user as any).prefs || {};
      await account.updatePrefs({ ...currentPrefs, [PREFS_KEY]: JSON.stringify(merged) }).catch(() => {});
    }
  } catch {}
  return merged;
}

export function subscribeConnectFeedSettings(cb: (s: ConnectFeedSettings) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) cb(normalize(detail));
  };
  if (typeof window !== 'undefined') window.addEventListener('kylrix-connect-feed-settings', handler as any);
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener('kylrix-connect-feed-settings', handler as any);
  };
}

const AFFINITY_KEY = 'kylrix_connect_affinity_v1';
type Affinity = { interests: string[]; mediaKinds: string[]; updatedAt: number };
function normalizeAffinity(raw: any): Affinity {
  if (!raw || typeof raw !== 'object') return { interests: [], mediaKinds: [], updatedAt: 0 };
  return {
    interests: Array.isArray(raw.interests) ? raw.interests.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 30) : [],
    mediaKinds: Array.isArray(raw.mediaKinds) ? raw.mediaKinds.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 10) : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}
export async function recordFeedInteraction(input: { topics?: string[]; mediaKind?: string }) {
  const topics = (input.topics || []).map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5);
  const mediaKind = String(input.mediaKind || '').toLowerCase().trim();
  if (!topics.length && !mediaKind) return;
  try {
    const cur = normalizeAffinity(await LocalEngine.cacheGet<any>(AFFINITY_KEY).catch(() => null));
    const nextInterests = Array.from(new Set([...topics, ...cur.interests])).slice(0, 30);
    const nextMedia = mediaKind ? Array.from(new Set([mediaKind, ...cur.mediaKinds])).slice(0, 10) : cur.mediaKinds;
    const next: Affinity = { interests: nextInterests, mediaKinds: nextMedia, updatedAt: Date.now() };
    await LocalEngine.cacheSet(AFFINITY_KEY, next);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix-connect-affinity', { detail: next }));
    // Merge affinity interests into live settings (offline + synced, curated phrases)
    if (topics.length) {
      const current = await getConnectFeedSettings();
      const mergedInterests = Array.from(new Set([...topics, ...current.interests])).slice(0, 20);
      if (mergedInterests.join('|') !== current.interests.join('|')) {
        await setConnectFeedSettings({ interests: mergedInterests });
      }
    }
  } catch {}
}
export async function getFeedAffinity(): Promise<Affinity> {
  try {
    const raw = await LocalEngine.cacheGet<any>(AFFINITY_KEY).catch(() => null);
    if (raw) return normalizeAffinity(raw);
  } catch {}
  return { interests: [], mediaKinds: [], updatedAt: 0 };
}

export const CONNECT_FEED_DEFAULTS = DEFAULTS;
