/**
 * Goal lock/unlock — same DEK pattern as vault secrets.
 * Non-empty `dek` means the object is encrypted; value is the MEK-wrapped DEK.
 * Share URLs append the unwrapped DEK as `/goal/[id]/[key]` (never the MEK).
 * Unlock (non-vault objects only) restores plaintext and clears `dek`.
 */

import { Permission, Role } from 'appwrite';
import { databases, getCurrentUser } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import type { Task as AppwriteTask } from '@/types/kylrixflow';

const DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TABLE = APPWRITE_CONFIG.TABLES.FLOW.TASKS;

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(atob(value).split('').map((char) => char.charCodeAt(0)));
}

function toUrlSafeBase64(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Locked iff DEK column is non-empty (vault-native rule). */
export function isGoalLocked(goal: { dek?: string | null }): boolean {
  return typeof goal?.dek === 'string' && goal.dek.trim().length > 0;
}

export async function lockGoal(goalId: string): Promise<AppwriteTask> {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Not authenticated');
  if (!ecosystemSecurity.status.isUnlocked) throw new Error('VAULT_LOCKED');

  const row = (await databases.getRow(DB, TABLE, goalId)) as AppwriteTask;
  const ownerId = row.userId || currentUser.$id;
  if (ownerId !== currentUser.$id) throw new Error('Permission denied');

  if (isGoalLocked(row)) return row;

  const { encryptField } = await import('@/lib/masterpass-crypto');

  const dek = await ecosystemSecurity.generateRandomMEK();
  const rawKey = await crypto.subtle.exportKey('raw', dek);
  const dekBase64 = bytesToBase64(new Uint8Array(rawKey));
  const wrappedDek = await encryptField(dekBase64);

  const encryptedTitle = await ecosystemSecurity.encryptWithKey(row.title || '', dek);
  const encryptedDescription = row.description
    ? await ecosystemSecurity.encryptWithKey(row.description, dek)
    : '';

  const permissions = [Permission.read(Role.user(ownerId))];

  const updated = await databases.updateRow(
    DB,
    TABLE,
    goalId,
    {
      title: encryptedTitle,
      description: encryptedDescription || null,
      dek: wrappedDek,
    },
    permissions,
  );

  return updated as unknown as AppwriteTask;
}

export async function unlockGoal(goalId: string): Promise<AppwriteTask> {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Not authenticated');
  if (!ecosystemSecurity.status.isUnlocked) throw new Error('VAULT_LOCKED');

  const row = (await databases.getRow(DB, TABLE, goalId)) as AppwriteTask;
  const ownerId = row.userId || currentUser.$id;
  if (ownerId !== currentUser.$id) throw new Error('Permission denied');

  if (!isGoalLocked(row)) return row;

  const { decryptField } = await import('@/lib/masterpass-crypto');
  const dekBase64 = await decryptField(row.dek!);
  const rawKey = base64ToBytes(dekBase64);
  const dek = await crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  const plaintextTitle = await ecosystemSecurity.decryptWithKey(row.title || '', dek);
  const plaintextDescription = row.description
    ? await ecosystemSecurity.decryptWithKey(row.description, dek)
    : '';

  const permissions = [Permission.read(Role.user(ownerId))];

  const updated = await databases.updateRow(
    DB,
    TABLE,
    goalId,
    {
      title: plaintextTitle,
      description: plaintextDescription || null,
      dek: null,
    },
    permissions,
  );

  return updated as unknown as AppwriteTask;
}

/** Session decrypt for opening a locked goal (does not clear dek). */
export async function decryptGoalForView(goal: {
  title?: string | null;
  description?: string | null;
  dek?: string | null;
}): Promise<{ title: string; description: string }> {
  if (!isGoalLocked(goal)) {
    return {
      title: goal.title || '',
      description: goal.description || '',
    };
  }
  if (!ecosystemSecurity.status.isUnlocked) {
    throw new Error('VAULT_LOCKED');
  }

  const { decryptField } = await import('@/lib/masterpass-crypto');
  const dekBase64 = await decryptField(goal.dek!);
  const rawKey = base64ToBytes(dekBase64);
  const dek = await crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  return {
    title: await ecosystemSecurity.decryptWithKey(goal.title || '', dek),
    description: goal.description
      ? await ecosystemSecurity.decryptWithKey(goal.description, dek)
      : '',
  };
}

/** Unwrap MEK-wrapped DEK and return a public share URL with `/[key]`. */
export async function getGoalShareUrlWithDek(goalId: string, wrappedDek?: string | null): Promise<string> {
  const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
  const baseUrl = buildPublicResourceUrl('goal', goalId);

  let currentDek = wrappedDek;
  if (!currentDek) {
    const row = (await databases.getRow(DB, TABLE, goalId)) as AppwriteTask;
    currentDek = row.dek;
  }

  if (!currentDek) return baseUrl;

  const { decryptField } = await import('@/lib/masterpass-crypto');
  const dekBase64 = await decryptField(currentDek);
  return `${baseUrl}/${toUrlSafeBase64(dekBase64)}`;
}

/** Build idea share URL with unwrapped DEK when present. */
export async function getNoteShareUrlWithDek(
  noteId: string,
  wrappedDek?: string | null,
): Promise<string> {
  const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
  const baseUrl = buildPublicResourceUrl('note', noteId);

  if (!wrappedDek) return baseUrl;

  const { decryptField } = await import('@/lib/masterpass-crypto');
  const dekBase64 = await decryptField(wrappedDek);
  return `${baseUrl}/${toUrlSafeBase64(dekBase64)}`;
}
