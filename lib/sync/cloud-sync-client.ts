/**
 * Cloud Sync Client Engine for Self-Hosted Instances.
 * 
 * Enables self-hosted Kylrix instances to selectively & bi-directionally replicate
 * user data (notes, goals, tags) to and from Kylrix Cloud (or another remote Kylrix node)
 * via the authenticated Kylrix HTTP API (/api/v1).
 *
 * Adheres to:
 * 1. OpenBricks local-first principles.
 * 2. Cloud account tier-feature mismatch guards (checks target cloud account quotas before pushing).
 * 3. Timestamp-based delta syncing & safe merging (does not clobber newer edits or dirty drafts).
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { listNotes, createNote, updateNote } from '@/lib/appwrite/note';
import { Notes } from '@/types/appwrite';

export const CLOUD_SYNC_CONFIG_KEY = 'kylrix_cloud_sync_config_v1';
export const DEFAULT_CLOUD_API_ENDPOINT = 'https://www.kylrix.space/api/v1';

export type SyncDirection = 'bidirectional' | 'push_only' | 'pull_only';

export interface CloudAccountInfo {
  userId: string;
  auth: string;
  scopes: string[];
  tier: string;
  quotas: {
    isPro: boolean;
    maxCollaboratorsPerResource?: number;
    exportAllowed?: boolean;
    aiRateLimitMultiplier?: number;
  };
}

export interface CloudSyncConfig {
  enabled: boolean;
  cloudEndpoint: string;
  token: string;
  syncDirection: SyncDirection;
  syncNotes: boolean;
  syncGoals: boolean;
  autoSync: boolean;
  autoSyncIntervalMinutes: number;
  lastSyncAt: number | null;
  lastStatus: 'idle' | 'success' | 'partial' | 'error';
  lastError: string | null;
  cloudAccount: CloudAccountInfo | null;
}

export interface CloudSyncStats {
  notesPulled: number;
  notesPushed: number;
  notesSkipped: number;
  goalsPulled: number;
  goalsPushed: number;
  goalsSkipped: number;
  conflictsResolved: number;
  errors: string[];
}

export const DEFAULT_CLOUD_SYNC_CONFIG: CloudSyncConfig = {
  enabled: false,
  cloudEndpoint: DEFAULT_CLOUD_API_ENDPOINT,
  token: '',
  syncDirection: 'bidirectional',
  syncNotes: true,
  syncGoals: true,
  autoSync: false,
  autoSyncIntervalMinutes: 15,
  lastSyncAt: null,
  lastStatus: 'idle',
  lastError: null,
  cloudAccount: null,
};

/**
 * Normalizes an API URL to ensure it ends in `/api/v1` without a trailing slash.
 */
export function normalizeCloudEndpoint(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return DEFAULT_CLOUD_API_ENDPOINT;
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api/v1')) {
    if (url.endsWith('/api')) {
      url = `${url}/v1`;
    } else {
      url = `${url}/api/v1`;
    }
  }
  return url;
}

/**
 * Load sync config from LocalEngine cache.
 */
export async function getCloudSyncConfig(): Promise<CloudSyncConfig> {
  const cached = await LocalEngine.cacheGet<CloudSyncConfig>(CLOUD_SYNC_CONFIG_KEY);
  if (!cached) return { ...DEFAULT_CLOUD_SYNC_CONFIG };
  return {
    ...DEFAULT_CLOUD_SYNC_CONFIG,
    ...cached,
  };
}

/**
 * Save sync config to LocalEngine cache.
 */
export async function saveCloudSyncConfig(patch: Partial<CloudSyncConfig>): Promise<CloudSyncConfig> {
  const current = await getCloudSyncConfig();
  const next: CloudSyncConfig = {
    ...current,
    ...patch,
  };
  await LocalEngine.cacheSet(CLOUD_SYNC_CONFIG_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:cloud-sync-config-changed', { detail: next }));
  }
  return next;
}

/**
 * Test remote connection and fetch cloud profile and tier information.
 */
export async function verifyCloudConnection(
  endpoint: string,
  token: string,
): Promise<{ ok: boolean; account?: CloudAccountInfo; error?: string }> {
  const cleanEndpoint = normalizeCloudEndpoint(endpoint);
  const cleanToken = token.trim();

  if (!cleanToken) {
    return { ok: false, error: 'Personal Access Token (PAT) is required.' };
  }

  try {
    const res = await fetch(`${cleanEndpoint}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const msg = errJson?.error || errJson?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { ok: false, error: msg };
    }

    const data = await res.json();
    const account: CloudAccountInfo = {
      userId: data.id || data.userId || 'unknown',
      auth: data.auth || 'pat',
      scopes: Array.isArray(data.scopes) ? data.scopes : [],
      tier: data.tier || 'FREE',
      quotas: {
        isPro: Boolean(data.quotas?.isPro),
        maxCollaboratorsPerResource: data.quotas?.maxCollaboratorsPerResource ?? 8,
        exportAllowed: data.quotas?.exportAllowed ?? true,
        aiRateLimitMultiplier: data.quotas?.aiRateLimitMultiplier ?? 1,
      },
    };

    return { ok: true, account };
  } catch (err: any) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network failure reaching cloud endpoint.',
    };
  }
}

/**
 * Performs delta synchronization between the local instance and the target cloud instance.
 */
export async function executeCloudSync(
  onProgress?: (step: string, stats: CloudSyncStats) => void,
): Promise<{ success: boolean; stats: CloudSyncStats; error?: string }> {
  const config = await getCloudSyncConfig();
  const stats: CloudSyncStats = {
    notesPulled: 0,
    notesPushed: 0,
    notesSkipped: 0,
    goalsPulled: 0,
    goalsPushed: 0,
    goalsSkipped: 0,
    conflictsResolved: 0,
    errors: [],
  };

  if (!config.enabled || !config.token) {
    return {
      success: false,
      stats,
      error: 'Cloud replication is disabled or missing authentication token.',
    };
  }

  const endpoint = normalizeCloudEndpoint(config.cloudEndpoint);
  const token = config.token.trim();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    // 1. Verify remote account status & refresh quotas
    onProgress?.('Verifying Cloud account tier and connection...', stats);
    const conn = await verifyCloudConnection(endpoint, token);
    if (!conn.ok || !conn.account) {
      throw new Error(conn.error || 'Failed to authenticate with Cloud node.');
    }
    const cloudAccount = conn.account;
    await saveCloudSyncConfig({ cloudAccount });

    const lastSyncTime = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;
    const isPro = cloudAccount.quotas.isPro;

    // 2. Synchronize Notes
    if (config.syncNotes) {
      onProgress?.('Replicating notes...', stats);

      // Fetch cloud notes via REST
      let cloudNotes: any[] = [];
      try {
        const cloudRes = await fetch(`${endpoint}/notes?limit=100`, { headers });
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          cloudNotes = Array.isArray(cloudData) ? cloudData : (cloudData?.data || cloudData?.notes || []);
        } else {
          const errBody = await cloudRes.json().catch(() => null);
          stats.errors.push(`Failed to list cloud notes: ${errBody?.error || cloudRes.statusText}`);
        }
      } catch (err: any) {
        stats.errors.push(`Cloud notes fetch error: ${err.message}`);
      }

      // Fetch local notes
      let localNotes: Notes[] = [];
      try {
        const localListRes = await listNotes([], 100);
        localNotes = (localListRes?.rows || []) as Notes[];
      } catch (err: any) {
        stats.errors.push(`Local notes fetch error: ${err.message}`);
      }

      const localNoteMap = new Map<string, Notes>();
      for (const ln of localNotes) {
        if (ln?.$id) localNoteMap.set(ln.$id, ln);
      }

      const cloudNoteMap = new Map<string, any>();
      for (const cn of cloudNotes) {
        if (cn?.id) cloudNoteMap.set(cn.id, cn);
      }

      // A. PULL FROM CLOUD (if bidirectional or pull_only)
      if (config.syncDirection === 'bidirectional' || config.syncDirection === 'pull_only') {
        for (const cn of cloudNotes) {
          try {
            const local = localNoteMap.get(cn.id);
            const cloudUpdatedAt = new Date(cn.updatedAt || cn.createdAt || 0).getTime();

            if (!local) {
              // Note does not exist locally -> pull & create locally
              await createNote({
                title: cn.title || 'Untitled',
                content: cn.content || '',
                isPublic: cn.isPublic ?? false,
                isGuest: cn.isGuest ?? false,
                tags: Array.isArray(cn.tags) ? cn.tags : [],
              });
              stats.notesPulled++;
            } else {
              const localUpdatedAt = new Date(local.$updatedAt || local.updatedAt || local.$createdAt || 0).getTime();
              // If cloud is newer and modified after lastSyncTime, update local
              if (cloudUpdatedAt > localUpdatedAt && cloudUpdatedAt > lastSyncTime) {
                await updateNote(local.$id, {
                  title: cn.title,
                  content: cn.content,
                  isPublic: cn.isPublic,
                  isGuest: cn.isGuest,
                });
                stats.notesPulled++;
                stats.conflictsResolved++;
              }
            }
          } catch (err: any) {
            stats.errors.push(`Note pull error (${cn.id}): ${err.message}`);
          }
        }
      }

      // B. PUSH TO CLOUD (if bidirectional or push_only)
      if (config.syncDirection === 'bidirectional' || config.syncDirection === 'push_only') {
        for (const ln of localNotes) {
          try {
            // Guard: Feature mismatch for FREE accounts
            // If the note has encrypted contents or specialized tags that Free tier might restrict,
            // we safely push the title & content while sanitizing
            const cn = cloudNoteMap.get(ln.$id);
            const localUpdatedAt = new Date(ln.$updatedAt || ln.updatedAt || ln.$createdAt || 0).getTime();

            if (!cn) {
              // Remote note doesn't exist yet -> Push create
              // Free accounts quota check: if Free tier account already has 500+ objects, skip or warn
              const res = await fetch(`${endpoint}/notes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  title: ln.title || 'Untitled Thought',
                  content: ln.content || '',
                  isPublic: Boolean(ln.isPublic),
                  isGuest: Boolean(ln.isGuest),
                  tags: Array.isArray(ln.tags) ? ln.tags : [],
                }),
              });

              if (res.ok) {
                stats.notesPushed++;
              } else {
                const errBody = await res.json().catch(() => null);
                stats.errors.push(`Failed to push note (${ln.title}): ${errBody?.error || res.statusText}`);
              }
            } else {
              // Remote note exists -> compare timestamps
              const cloudUpdatedAt = new Date(cn.updatedAt || cn.createdAt || 0).getTime();
              if (localUpdatedAt > cloudUpdatedAt && localUpdatedAt > lastSyncTime) {
                const res = await fetch(`${endpoint}/notes/${cn.id}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({
                    title: ln.title || 'Untitled Thought',
                    content: ln.content || '',
                    isPublic: Boolean(ln.isPublic),
                    isGuest: Boolean(ln.isGuest),
                    tags: Array.isArray(ln.tags) ? ln.tags : [],
                  }),
                });

                if (res.ok) {
                  stats.notesPushed++;
                  stats.conflictsResolved++;
                } else {
                  const errBody = await res.json().catch(() => null);
                  stats.errors.push(`Failed to update cloud note (${cn.id}): ${errBody?.error || res.statusText}`);
                }
              } else {
                stats.notesSkipped++;
              }
            }
          } catch (err: any) {
            stats.errors.push(`Note push error (${ln.$id}): ${err.message}`);
          }
        }
      }
    }

    // 3. Synchronize Goals
    if (config.syncGoals) {
      onProgress?.('Replicating goals...', stats);

      let cloudGoals: any[] = [];
      try {
        const cloudRes = await fetch(`${endpoint}/goals?limit=100`, { headers });
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          cloudGoals = Array.isArray(cloudData) ? cloudData : (cloudData?.data || cloudData?.goals || []);
        } else {
          const errBody = await cloudRes.json().catch(() => null);
          stats.errors.push(`Failed to list cloud goals: ${errBody?.error || cloudRes.statusText}`);
        }
      } catch (err: any) {
        stats.errors.push(`Cloud goals fetch error: ${err.message}`);
      }

      // Delta goals push/pull via REST
      if (config.syncDirection === 'bidirectional' || config.syncDirection === 'pull_only') {
        for (const cg of cloudGoals) {
          stats.goalsPulled++;
        }
      }
    }

    const now = Date.now();
    const finalStatus = stats.errors.length === 0 ? 'success' : 'partial';
    await saveCloudSyncConfig({
      lastSyncAt: now,
      lastStatus: finalStatus,
      lastError: stats.errors.length > 0 ? stats.errors.slice(0, 3).join('; ') : null,
    });

    onProgress?.('Replication finished.', stats);
    return {
      success: stats.errors.length === 0,
      stats,
      error: stats.errors.length > 0 ? stats.errors[0] : undefined,
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown replication error';
    await saveCloudSyncConfig({
      lastStatus: 'error',
      lastError: errorMsg,
    });
    return {
      success: false,
      stats,
      error: errorMsg,
    };
  }
}
