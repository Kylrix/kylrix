import { listMyFlowInstallsSecure } from '@/lib/actions/secure-ops/flows';

const KEY = 'kylrix_installed_flows';
let inMemoryInstalledIds: string[] | null = null;

function read(): string[] {
  if (typeof window === 'undefined') return inMemoryInstalledIds || [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return inMemoryInstalledIds || [];
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed.map(String) : [];
    inMemoryInstalledIds = ids;
    return ids;
  } catch {
    return inMemoryInstalledIds || [];
  }
}

function write(ids: string[]) {
  const unique = [...new Set(ids)];
  inMemoryInstalledIds = unique;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(unique));
  } catch {}
}

export function listInstalledFlowIds(): string[] {
  return read();
}

export function isFlowInstalled(id: string): boolean {
  return read().includes(id);
}

export function installFlowLocal(id: string): string[] {
  const next = [...read(), id];
  write(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'install' } }));
  }
  return [...new Set(next)];
}

export function uninstallFlowLocal(id: string): string[] {
  const next = read().filter((x) => x !== id);
  write(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { id, action: 'uninstall' } }));
  }
  return next;
}

export function syncInstalledFlowsFromRemote(remoteFlowIds: string[]): string[] {
  const current = read();
  const merged = [...new Set([...current, ...remoteFlowIds])];
  write(merged);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:flows-changed', { detail: { action: 'sync' } }));
  }
  return merged;
}

export async function pullAndSyncUserFlowInstalls(): Promise<string[]> {
  try {
    const res = await listMyFlowInstallsSecure();
    if (res.success && Array.isArray(res.data)) {
      const activeIds = res.data
        .filter((row: any) => row.status === 'active')
        .map((row: any) => String(row.flowId));
      return syncInstalledFlowsFromRemote(activeIds);
    }
  } catch {
    // quiet fallback to local storage
  }
  return read();
}
