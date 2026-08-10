'use client';

import { getActivePartitionId, setActivePartitionId, resolvePartitionId } from './partition';

export type StoredAccount = {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  avatar?: string | null;
  addedAt: number;
  // Appwrite session token stored per-account for seamless switching
  sessionSecret?: string | null;
  sessionId?: string | null;
};

const ACCOUNTS_KEY = 'kylrix:accounts';

function readAccounts(): StoredAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch { return []; }
}

function writeAccounts(list: StoredAccount[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export function listAccounts(): StoredAccount[] {
  return readAccounts();
}

export function listOtherAccounts(activeId?: string | null): StoredAccount[] {
  const all = readAccounts();
  if (!activeId) return all;
  return all.filter(a => a.id !== activeId);
}

export function upsertAccount(acct: StoredAccount) {
  const all = readAccounts();
  const idx = all.findIndex(a => a.id === acct.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...acct };
  else all.push(acct);
  writeAccounts(all);
}

export function removeAccount(id: string) {
  writeAccounts(readAccounts().filter(a => a.id !== id));
}

export function getAccount(id: string): StoredAccount | null {
  return readAccounts().find(a => a.id === id) || null;
}

/**
 * Store the Appwrite session secret for an account so it can be restored on switch.
 * Called right after successful login while the session is fresh.
 */
export function storeAccountSession(userId: string, sessionId: string, sessionSecret: string) {
  const all = readAccounts();
  const idx = all.findIndex(a => a.id === userId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], sessionId, sessionSecret };
    writeAccounts(all);
  }
}

// Called on successful login: ensure vault has current user
export function ensureCurrentAccountInVault(user: { $id: string; name?: string | null; email?: string | null; username?: string | null }) {
  if (!user?.$id) return;
  upsertAccount({ id: user.$id, name: user.name ?? null, email: user.email ?? null, username: (user as any).username ?? null, addedAt: Date.now() });
  // keep active partition in sync
  const pid = resolvePartitionId(user.$id);
  setActivePartitionId(pid as any);
}

export function getActiveAccountId(): string | null {
  const pid = getActivePartitionId();
  if (!pid || pid === 'acc_default') return null;
  return pid.replace('_acc_', '');
}
