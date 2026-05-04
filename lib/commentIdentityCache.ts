import type { Users } from '@/types/appwrite';

const CACHE_KEY = 'kylrix_comment_identity_cache_v1';

export type CommentIdentitySnapshot = Pick<
  Users,
  '$id' | 'id' | 'username' | 'displayName' | 'name' | 'email' | 'avatar' | 'profilePicId' | 'bio' | 'prefs' | 'createdAt' | 'updatedAt'
>;

type CommentIdentityStore = Record<string, CommentIdentitySnapshot>;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function loadStore(): CommentIdentityStore {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CommentIdentityStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: CommentIdentityStore) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / serialization errors.
  }
}

export function toCommentIdentitySnapshot(user: Partial<Users> & { $id?: string | null; id?: string | null }): CommentIdentitySnapshot | null {
  const userId = user.$id || user.id || null;
  if (!userId) return null;

  return {
    $id: userId,
    id: user.id || user.$id || userId,
    username: user.username || null,
    displayName: user.displayName || null,
    name: user.name || null,
    email: user.email || null,
    avatar: user.avatar || null,
    profilePicId: user.profilePicId || null,
    bio: user.bio || null,
    prefs: (user as Users).prefs || null,
    createdAt: (user as Users).createdAt || null,
    updatedAt: (user as Users).updatedAt || null,
  };
}

export function hydrateCommentIdentity(snapshot?: CommentIdentitySnapshot | null): Users | null {
  if (!snapshot || !snapshot.$id) return null;
  return {
    ...(snapshot as unknown as Users),
    $id: snapshot.$id,
    id: snapshot.id || snapshot.$id,
  } as Users;
}

export function getCachedCommentIdentity(userId?: string | null): Users | null {
  if (!userId) return null;
  const store = loadStore();
  return hydrateCommentIdentity(store[userId] || null);
}

export function getCachedCommentIdentities(userIds: string[]): Record<string, Users> {
  const store = loadStore();
  return userIds.reduce<Record<string, Users>>((acc, userId) => {
    const hydrated = hydrateCommentIdentity(store[userId] || null);
    if (hydrated) acc[userId] = hydrated;
    return acc;
  }, {});
}

export function upsertCommentIdentity(user: Partial<Users> & { $id?: string | null; id?: string | null }) {
  const snapshot = toCommentIdentitySnapshot(user);
  if (!snapshot) return;
  const store = loadStore();
  store[snapshot.$id] = snapshot;
  saveStore(store);
}

export function upsertCommentIdentities(users: Array<Partial<Users> & { $id?: string | null; id?: string | null }>) {
  if (!users.length) return;
  const store = loadStore();
  let changed = false;

  for (const user of users) {
    const snapshot = toCommentIdentitySnapshot(user);
    if (!snapshot) continue;
    store[snapshot.$id] = snapshot;
    changed = true;
  }

  if (changed) saveStore(store);
}
