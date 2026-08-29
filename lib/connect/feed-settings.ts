'use client';

import { LocalEngine } from '@/lib/services/LocalEngine';
import { account } from '@/lib/appwrite/client';

export type NostrRelayConfig = {
  url: string;
  read: boolean;
  write: boolean;
};

export type NostrPerformanceSettings = {
  eagerMediaLoading: boolean;
  autoplayVideos: boolean;
  maxConcurrentRelaySockets: number;
  feedPageLimit: number;
  cacheStrategy: 'indexedDB' | 'memory' | 'localEngine';
};

export type NostrProtocolSettings = {
  outboxModel: boolean;
  nip07Support: boolean;
  nip46RemoteSigner: boolean;
};

export type NostrSettingsConfig = {
  relays: {
    defaults: NostrRelayConfig[];
    lookupIndexers: string[];
  };
  performance: NostrPerformanceSettings;
  protocol: NostrProtocolSettings;
};

export type ConnectFeedSettings = {
  topics: string[];
  interests: string[];
  autoPreviewMedia: boolean;
  dataSaverMode: boolean;
  showNostr: boolean;
  showEcosystem: boolean;
  showReplies: boolean;
  showLikes: boolean;
  compactMode: boolean;
  autoPlayMedia: boolean;
  nostrConfig: NostrSettingsConfig;
};

export const NOSTR_CONFIG_DEFAULTS: NostrSettingsConfig = {
  relays: {
    defaults: [
      { url: 'wss://relay.damus.io', read: true, write: true },
      { url: 'wss://nos.lol', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
      { url: 'wss://relay.nostr.band', read: true, write: true },
    ],
    lookupIndexers: [
      'wss://purplepag.es',
      'wss://user.kindpag.es',
    ],
  },
  performance: {
    eagerMediaLoading: false,
    autoplayVideos: false,
    maxConcurrentRelaySockets: 3,
    feedPageLimit: 15,
    cacheStrategy: 'indexedDB',
  },
  protocol: {
    outboxModel: true,
    nip07Support: true,
    nip46RemoteSigner: true,
  },
};

const DEFAULTS: ConnectFeedSettings = {
  topics: [],
  interests: ['builders', 'nostr', 'kylrix'],
  autoPreviewMedia: true,
  dataSaverMode: true,
  showNostr: true,
  showEcosystem: true,
  showReplies: true,
  showLikes: true,
  compactMode: false,
  autoPlayMedia: false,
  nostrConfig: NOSTR_CONFIG_DEFAULTS,
};

const LOCAL_KEY = 'kylrix_connect_feed_settings_v1';
const PREFS_KEY = 'connectFeedSettings';
const REMOTE_SYNC_TTL_MS = 60_000;
let remoteSyncInFlight: Promise<void> | null = null;
let lastRemoteSyncAt = 0;

function normalizeNostrConfig(raw: any): NostrSettingsConfig {
  if (!raw || typeof raw !== 'object') return { ...NOSTR_CONFIG_DEFAULTS };
  const rawRelays = raw.relays;
  const defaults: NostrRelayConfig[] = Array.isArray(rawRelays?.defaults)
    ? rawRelays.defaults
        .filter((r: any) => r && typeof r.url === 'string' && r.url.trim().startsWith('ws'))
        .map((r: any) => ({
          url: String(r.url).trim(),
          read: typeof r.read === 'boolean' ? r.read : true,
          write: typeof r.write === 'boolean' ? r.write : true,
        }))
    : NOSTR_CONFIG_DEFAULTS.relays.defaults;

  const lookupIndexers: string[] = Array.isArray(rawRelays?.lookupIndexers)
    ? rawRelays.lookupIndexers
        .filter((u: any) => typeof u === 'string' && u.trim().startsWith('ws'))
        .map((u: string) => u.trim())
    : NOSTR_CONFIG_DEFAULTS.relays.lookupIndexers;

  const rawPerf = raw.performance;
  const performance: NostrPerformanceSettings = {
    eagerMediaLoading: typeof rawPerf?.eagerMediaLoading === 'boolean' ? rawPerf.eagerMediaLoading : NOSTR_CONFIG_DEFAULTS.performance.eagerMediaLoading,
    autoplayVideos: typeof rawPerf?.autoplayVideos === 'boolean' ? rawPerf.autoplayVideos : NOSTR_CONFIG_DEFAULTS.performance.autoplayVideos,
    maxConcurrentRelaySockets: typeof rawPerf?.maxConcurrentRelaySockets === 'number' ? rawPerf.maxConcurrentRelaySockets : NOSTR_CONFIG_DEFAULTS.performance.maxConcurrentRelaySockets,
    feedPageLimit: typeof rawPerf?.feedPageLimit === 'number' ? rawPerf.feedPageLimit : NOSTR_CONFIG_DEFAULTS.performance.feedPageLimit,
    cacheStrategy: rawPerf?.cacheStrategy === 'memory' || rawPerf?.cacheStrategy === 'localEngine' ? rawPerf.cacheStrategy : 'indexedDB',
  };

  const rawProto = raw.protocol;
  const protocol: NostrProtocolSettings = {
    outboxModel: typeof rawProto?.outboxModel === 'boolean' ? rawProto.outboxModel : NOSTR_CONFIG_DEFAULTS.protocol.outboxModel,
    nip07Support: typeof rawProto?.nip07Support === 'boolean' ? rawProto.nip07Support : NOSTR_CONFIG_DEFAULTS.protocol.nip07Support,
    nip46RemoteSigner: typeof rawProto?.nip46RemoteSigner === 'boolean' ? rawProto.nip46RemoteSigner : NOSTR_CONFIG_DEFAULTS.protocol.nip46RemoteSigner,
  };

  return {
    relays: {
      defaults: defaults.length ? defaults : NOSTR_CONFIG_DEFAULTS.relays.defaults,
      lookupIndexers: lookupIndexers.length ? lookupIndexers : NOSTR_CONFIG_DEFAULTS.relays.lookupIndexers,
    },
    performance,
    protocol,
  };
}

function normalize(raw: any): ConnectFeedSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  return {
    topics: Array.isArray(raw.topics) ? raw.topics.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 20) : [...DEFAULTS.topics],
    interests: Array.isArray(raw.interests) ? raw.interests.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 20) : [...DEFAULTS.interests],
    autoPreviewMedia: typeof raw.autoPreviewMedia === 'boolean' ? raw.autoPreviewMedia : DEFAULTS.autoPreviewMedia,
    dataSaverMode: typeof raw.dataSaverMode === 'boolean' ? raw.dataSaverMode : DEFAULTS.dataSaverMode,
    showNostr: typeof raw.showNostr === 'boolean' ? raw.showNostr : DEFAULTS.showNostr,
    showEcosystem: typeof raw.showEcosystem === 'boolean' ? raw.showEcosystem : DEFAULTS.showEcosystem,
    showReplies: typeof raw.showReplies === 'boolean' ? raw.showReplies : DEFAULTS.showReplies,
    showLikes: typeof raw.showLikes === 'boolean' ? raw.showLikes : DEFAULTS.showLikes,
    compactMode: typeof raw.compactMode === 'boolean' ? raw.compactMode : DEFAULTS.compactMode,
    autoPlayMedia: typeof raw.autoPlayMedia === 'boolean' ? raw.autoPlayMedia : DEFAULTS.autoPlayMedia,
    nostrConfig: normalizeNostrConfig(raw.nostrConfig),
  };
}

async function broadcastFeedSettingsIfChanged(normalizedRemote: ConnectFeedSettings) {
  const current = (await LocalEngine.cacheGet<any>(LOCAL_KEY).catch(() => null)) as ConnectFeedSettings | null;
  const prev = current ? normalize(current) : null;
  const changed =
    !prev ||
    prev.topics.join('|') !== normalizedRemote.topics.join('|') ||
    prev.interests.join('|') !== normalizedRemote.interests.join('|') ||
    prev.showNostr !== normalizedRemote.showNostr ||
    prev.showEcosystem !== normalizedRemote.showEcosystem ||
    prev.showReplies !== normalizedRemote.showReplies ||
    prev.showLikes !== normalizedRemote.showLikes ||
    prev.compactMode !== normalizedRemote.compactMode ||
    prev.autoPreviewMedia !== normalizedRemote.autoPreviewMedia ||
    prev.dataSaverMode !== normalizedRemote.dataSaverMode ||
    prev.autoPlayMedia !== normalizedRemote.autoPlayMedia;
  if (!changed) return;
  await LocalEngine.cacheSet(LOCAL_KEY, normalizedRemote);
  if (typeof window !== 'undefined') {
    (window as any).__KylrixConnectFeedSettings = normalizedRemote;
    window.dispatchEvent(new CustomEvent('kylrix-connect-feed-settings', { detail: normalizedRemote }));
  }
}

function scheduleRemoteFeedSettingsSync() {
  const now = Date.now();
  if (now - lastRemoteSyncAt < REMOTE_SYNC_TTL_MS) return;
  if (remoteSyncInFlight) return;
  lastRemoteSyncAt = now;
  remoteSyncInFlight = (async () => {
    try {
      const user = await account.get().catch(() => null as any);
      const prefsRaw = (user as any)?.prefs?.[PREFS_KEY];
      if (prefsRaw) {
        const parsed = typeof prefsRaw === 'string' ? JSON.parse(prefsRaw) : prefsRaw;
        await broadcastFeedSettingsIfChanged(normalize(parsed));
      }
    } catch {
      /* quiet */
    } finally {
      remoteSyncInFlight = null;
    }
  })();
}

export async function getConnectFeedSettings(): Promise<ConnectFeedSettings> {
  let localResult: ConnectFeedSettings | null = null;
  try {
    const local = await LocalEngine.cacheGet<any>(LOCAL_KEY).catch(() => null);
    if (local) {
      localResult = normalize(local);
      if (typeof window !== 'undefined') {
        (window as any).__KylrixConnectFeedSettings = localResult;
      }
    }
  } catch {}

  // One background sync per minute max — not one account.get per caller.
  scheduleRemoteFeedSettingsSync();

  if (localResult) return localResult;

  try {
    const user = await account.get().catch(() => null as any);
    const prefsRaw = (user as any)?.prefs?.[PREFS_KEY];
    if (prefsRaw) {
      const parsed = typeof prefsRaw === 'string' ? JSON.parse(prefsRaw) : prefsRaw;
      const normalizedRemote = normalize(parsed);
      await LocalEngine.cacheSet(LOCAL_KEY, normalizedRemote);
      return normalizedRemote;
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
  // Sync to user live settings (prefs) immediately
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
function isSimilarTerm(a: string, b: string): boolean {
  const cleanA = a.replace(/:\d+$/, '').toLowerCase();
  const cleanB = b.replace(/:\d+$/, '').toLowerCase();
  if (cleanA === cleanB) return true;
  // Match common prefixes if length is >= 4 (e.g. productiv* matches productive & productivity)
  const minLen = Math.min(cleanA.length, cleanB.length);
  if (minLen >= 4) {
    const prefixLen = Math.floor(minLen * 0.75);
    if (cleanA.slice(0, prefixLen) === cleanB.slice(0, prefixLen)) {
      return true;
    }
  }
  return false;
}

export async function recordFeedInteraction(input: { topics?: string[]; mediaKind?: string; searchWeight?: number }) {
  const weight = input.searchWeight || 1;
  const rawTopics = (input.topics || []).map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5);
  const mediaKind = String(input.mediaKind || '').toLowerCase().trim();
  if (!rawTopics.length && !mediaKind) return;
  try {
    const cur = normalizeAffinity(await LocalEngine.cacheGet<any>(AFFINITY_KEY).catch(() => null));
    
    // Deduplicate against existing topics using dynamic stem/fuzzy matching
    const filteredNewTopics = rawTopics.filter(newT => {
      return !cur.interests.some(existing => isSimilarTerm(newT, existing));
    });

    const formattedTopics = weight > 1 ? filteredNewTopics.map(t => `${t}:${weight}`) : filteredNewTopics;
    const nextInterests = Array.from(new Set([...formattedTopics, ...cur.interests])).slice(0, 30);
    const nextMedia = mediaKind ? Array.from(new Set([mediaKind, ...cur.mediaKinds])).slice(0, 10) : cur.mediaKinds;
    const next: Affinity = { interests: nextInterests, mediaKinds: nextMedia, updatedAt: Date.now() };
    await LocalEngine.cacheSet(AFFINITY_KEY, next);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kylrix-connect-affinity', { detail: next }));
    // Merge affinity interests into live settings (offline + synced, curated phrases)
    if (formattedTopics.length) {
      const current = await getConnectFeedSettings();
      const mergedInterests = Array.from(new Set([...formattedTopics, ...current.interests])).slice(0, 20);
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

export async function getNostrReadRelays(): Promise<string[]> {
  const settings = await getConnectFeedSettings();
  const configured = (settings.nostrConfig?.relays?.defaults || [])
    .filter(r => r.read && r.url)
    .map(r => r.url);
  return configured.length > 0 ? configured : NOSTR_CONFIG_DEFAULTS.relays.defaults.map(r => r.url);
}

export async function getNostrWriteRelays(): Promise<string[]> {
  const settings = await getConnectFeedSettings();
  const configured = (settings.nostrConfig?.relays?.defaults || [])
    .filter(r => r.write && r.url)
    .map(r => r.url);
  return configured.length > 0 ? configured : NOSTR_CONFIG_DEFAULTS.relays.defaults.map(r => r.url);
}

export const CONNECT_FEED_DEFAULTS = DEFAULTS;
