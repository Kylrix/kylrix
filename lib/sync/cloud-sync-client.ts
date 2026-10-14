/**
 * Cloud Sync Client Engine for Self-Hosted Instances.
 * 
 * Enables self-hosted Kylrix instances to selectively & bi-directionally replicate
 * user data (notes, goals, tags) to and from Kylrix Cloud (or another remote Kylrix node)
 * via the authenticated Kylrix HTTP API (/api/v1).
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

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
  node?: {
    isCloud?: boolean;
    isSelfHosted?: boolean;
    isKylrixCloud?: boolean;
    capabilities?: string[];
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
  accountReplicated?: boolean;
  keychainCount?: number;
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

    try {
      const hsRes = await fetch(`${cleanEndpoint}/sync/handshake`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
      });
      if (hsRes.ok) {
        const hsData = await hsRes.json();
        const payload = hsData?.data || hsData;
        if (payload?.node) {
          account.node = {
            isCloud: Boolean(payload.node.isCloud),
            isSelfHosted: Boolean(payload.node.isSelfHosted),
            isKylrixCloud: Boolean(payload.node.isKylrixCloud),
            capabilities: Array.isArray(payload.node.capabilities) ? payload.node.capabilities : [],
          };
        }
      }
    } catch (_e) {}

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

  try {
    onProgress?.('Verifying Cloud account tier and connection...', stats);
    const conn = await verifyCloudConnection(endpoint, token);
    if (!conn.ok || !conn.account) {
      throw new Error(conn.error || 'Failed to authenticate with Cloud node.');
    }
    const cloudAccount = conn.account;
    await saveCloudSyncConfig({ cloudAccount });

    const { effectiveTierHasPaidAccess } = await import('@/lib/entitlements');
    const isPaidCloud = Boolean(cloudAccount.quotas?.isPro) || effectiveTierHasPaidAccess(cloudAccount.tier);
    if (!isPaidCloud) {
      throw new Error('Cloud sync requires a paid plan. Upgrade your Cloud account to enable replication.');
    }

    onProgress?.('Replicating account identity & master encryption keychain...', stats);
    try {
      const { replicateAccountAndKeychainSecure } = await import('@/lib/actions/secure-ops/misc');
      const replRes = await replicateAccountAndKeychainSecure({
        cloudEndpoint: endpoint,
        token,
      });

      if (replRes.success) {
        stats.accountReplicated = true;
        stats.keychainCount = replRes.keychainCount ?? 1;
      } else if (replRes.error) {
        stats.errors.push(`Account/Keychain replication warning: ${replRes.error}`);
      }
    } catch (err: any) {
      stats.errors.push(`Account/Keychain replication error: ${err?.message || err}`);
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
