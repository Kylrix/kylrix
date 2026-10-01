import { listMyFlowInstallsSecure } from '@/lib/actions/secure-ops/flows';
import { LocalEngine } from '@/lib/services/LocalEngine';

export const BASE_LOCAL_KEY = 'f_installed_flows';

export function getInstalledFlowsKey(userId?: string | null): string {
  return userId ? `f_installed_flows_${userId}` : BASE_LOCAL_KEY;
}

let inMemoryInstalledIds: string[] = [];
let currentFlowsUserId: string | null = null;
let isHydrated = false;

// Eagerly bootstrap from LocalEngine/RxDB on client load
if (typeof window !== 'undefined') {
  void (async () => {
    try {
      const cached = await LocalEngine.cacheGet<string[]>(BASE_LOCAL_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        inMemoryInstalledIds = [...new Set(cached)];
        isHydrated = true;
      }
    } catch {}
  })();

  window.addEventListener('kylrix:auth:logout', () => {
    clearInstalledFlowsMemory();
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { action: 'logout' } }));
  });
}

function write(ids: string[], userId?: string | null) {
  const unique = [...new Set(ids)];
  inMemoryInstalledIds = unique;
  currentFlowsUserId = userId || null;
  isHydrated = true;
  if (typeof window !== 'undefined') {
    const key = getInstalledFlowsKey(userId);
    void LocalEngine.cacheSet(key, unique).catch(() => {});
    if (key !== BASE_LOCAL_KEY) {
      void LocalEngine.cacheSet(BASE_LOCAL_KEY, unique).catch(() => {});
    }
  }
}

export function listInstalledFlowIds(userId?: string | null): string[] {
  if (userId && currentFlowsUserId && userId !== currentFlowsUserId) {
    return [];
  }
  return inMemoryInstalledIds;
}

export function isFlowInstalled(id: string, userId?: string | null): boolean {
  if (userId && currentFlowsUserId && userId !== currentFlowsUserId) {
    return false;
  }
  return inMemoryInstalledIds.includes(id);
}

export function installFlowLocal(id: string, userId?: string | null): string[] {
  const next = [...inMemoryInstalledIds, id];
  const targetUid = userId || currentFlowsUserId;
  write(next, targetUid);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'install', userId: targetUid } }));
  }
  return [...new Set(next)];
}

export function uninstallFlowLocal(id: string, userId?: string | null): string[] {
  const next = inMemoryInstalledIds.filter((x) => x !== id);
  const targetUid = userId || currentFlowsUserId;
  write(next, targetUid);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'uninstall', userId: targetUid } }));
  }
  return next;
}

export function syncInstalledFlowsFromRemote(remoteFlowIds: string[], userId?: string | null): string[] {
  // Authoritative active installs for this specific user account
  const authoritative = [...new Set(remoteFlowIds)];
  const targetUid = userId || currentFlowsUserId;
  write(authoritative, targetUid);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { action: 'sync', userId: targetUid } }));
  }
  return authoritative;
}

export function clearInstalledFlowsMemory(): void {
  inMemoryInstalledIds = [];
  currentFlowsUserId = null;
  isHydrated = false;
}

export async function pullAndSyncUserFlowInstalls(targetUserId?: string | null): Promise<string[]> {
  try {
    let jwt: string | undefined;
    let userId = targetUserId;
    if (typeof window !== 'undefined') {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const u = await account.get().catch(() => null);
        if (u?.$id) userId = u.$id;
        const tokenRes = await account.createJWT().catch(() => null);
        jwt = tokenRes?.jwt;
      } catch {}
    }

    if (!userId) {
      clearInstalledFlowsMemory();
      return [];
    }

    // Account switch: wipe stale previous account flows from RAM
    if (currentFlowsUserId && currentFlowsUserId !== userId) {
      inMemoryInstalledIds = [];
      isHydrated = false;
    }
    currentFlowsUserId = userId;

    // 1. Initial hydration from user-scoped RxDB / LocalEngine cache
    if (!isHydrated) {
      const cached = await LocalEngine.cacheGet<string[]>(getInstalledFlowsKey(userId));
      if (Array.isArray(cached) && cached.length > 0) {
        inMemoryInstalledIds = [...new Set(cached)];
        isHydrated = true;
      }
    }

    // 2. Fetch authoritative active installs from Server Action with client JWT
    const res = await listMyFlowInstallsSecure(jwt);
    if (res.success && Array.isArray(res.data)) {
      const activeIds = res.data
        .filter((row: any) => row.status === 'active')
        .map((row: any) => String(row.flowId));
      return syncInstalledFlowsFromRemote(activeIds, userId);
    }
  } catch {
    // quiet fallback
  }
  return inMemoryInstalledIds;
}
