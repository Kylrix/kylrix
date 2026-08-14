import { listMyFlowInstallsSecure } from '@/lib/actions/secure-ops/flows';
import { LocalEngine } from '@/lib/services/LocalEngine';

const LOCAL_KEY = 'f_installed_flows';
let inMemoryInstalledIds: string[] = [];
let isHydrated = false;

// Eagerly bootstrap from LocalEngine/RxDB on client load
if (typeof window !== 'undefined') {
  void (async () => {
    try {
      const cached = await LocalEngine.cacheGet<string[]>(LOCAL_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        inMemoryInstalledIds = [...new Set(cached)];
        isHydrated = true;
      }
    } catch {}
  })();
}

function write(ids: string[]) {
  const unique = [...new Set(ids)];
  inMemoryInstalledIds = unique;
  isHydrated = true;
  if (typeof window !== 'undefined') {
    void LocalEngine.cacheSet(LOCAL_KEY, unique).catch(() => {});
  }
}

export function listInstalledFlowIds(): string[] {
  return inMemoryInstalledIds;
}

export function isFlowInstalled(id: string): boolean {
  return inMemoryInstalledIds.includes(id);
}

export function installFlowLocal(id: string): string[] {
  const next = [...inMemoryInstalledIds, id];
  write(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'install' } }));
  }
  return [...new Set(next)];
}

export function uninstallFlowLocal(id: string): string[] {
  const next = inMemoryInstalledIds.filter((x) => x !== id);
  write(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'uninstall' } }));
  }
  return next;
}

export function syncInstalledFlowsFromRemote(remoteFlowIds: string[]): string[] {
  const merged = [...new Set([...inMemoryInstalledIds, ...remoteFlowIds])];
  write(merged);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { action: 'sync' } }));
  }
  return merged;
}

export async function pullAndSyncUserFlowInstalls(): Promise<string[]> {
  try {
    // 1. Initial hydration from RxDB substrate if in-memory is empty
    if (!isHydrated) {
      const cached = await LocalEngine.cacheGet<string[]>(LOCAL_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        inMemoryInstalledIds = [...new Set(cached)];
        isHydrated = true;
      }
    }

    // 2. Fetch authoritative active installs from Server Action with client JWT
    let jwt: string | undefined;
    if (typeof window !== 'undefined') {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const tokenRes = await account.createJWT().catch(() => null);
        jwt = tokenRes?.jwt;
      } catch {}
    }

    const res = await listMyFlowInstallsSecure(jwt);
    if (res.success && Array.isArray(res.data)) {
      const activeIds = res.data
        .filter((row: any) => row.status === 'active')
        .map((row: any) => String(row.flowId));
      return syncInstalledFlowsFromRemote(activeIds);
    }
  } catch {
    // quiet fallback
  }
  return inMemoryInstalledIds;
}
