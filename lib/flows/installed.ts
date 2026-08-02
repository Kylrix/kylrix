const KEY = 'kylrix_installed_flows';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
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
