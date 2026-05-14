import { Permission, Role } from 'appwrite';
import { tablesDB, storage } from '../appwrite';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getEcosystemUrl } from '../constants/ecosystem';
import { seedIdentityCache } from '../identity-cache';

/** Ecosystem profiles / directory (same as standalone Connect): CHAT » profiles */
const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

const PROFILE_ROW_TTL_MS = 15 * 60 * 1000;
const profileRowCache = new Map<string, { row: any; at: number }>();
const batchState = {
    queue: new Set<string>(),
    timer: null as any,
    promises: new Map<string, Array<{ resolve: (v: any) => void; reject: (e: any) => void }>>(),
};

function normalizeUsernameSuggestion(input: string | null | undefined): string | null {
    if (!input) return null;
    const cleaned = input
        .toString()
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
    return cleaned || null;
}

function deriveUsernameCandidates(user: { $id: string; email?: string; name?: string }): string[] {
    const nameParts = user.name ? user.name.trim().split(/\s+/).filter(Boolean) : [];
    const firstName = nameParts[0] || '';
    const surname = nameParts[1] || '';
    const emailPrefix = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : '';
    const raw = [
        normalizeUsernameSuggestion(firstName),
        normalizeUsernameSuggestion(surname),
        normalizeUsernameSuggestion(emailPrefix),
        normalizeUsernameSuggestion(`u${user.$id.slice(0, 12)}`),
    ].filter(Boolean) as string[];
    return Array.from(new Set(raw));
}

function fallbackUsernameFromUser(userId: string, email?: string | null): string {
    const ep = email ? normalizeUsernameSuggestion(email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')) : null;
    if (ep && ep.length >= 3) return ep;
    const fb = normalizeUsernameSuggestion(`u${userId.slice(0, 12)}`);
    return fb && fb.length >= 3 ? fb : `u${userId.slice(0, 12)}`;
}

/** Normalized @handle ideas for onboarding (deduped). Mirrors legacy Discoverability username rules. */
export function buildUsernameHandleSuggestions(user: {
    $id: string;
    email?: string | null;
    name?: string | null;
}): string[] {
    const candidates = deriveUsernameCandidates({
        $id: user.$id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
    });
    const out: string[] = [];
    for (const c of candidates) {
        const n = normalizeUsernameSuggestion(c);
        if (n && n.length >= 3) out.push(n);
    }
    const fb = normalizeUsernameSuggestion(fallbackUsernameFromUser(user.$id, user.email ?? null));
    if (fb && fb.length >= 3) out.push(fb);
    return Array.from(new Set(out)).slice(0, 6);
}

function rememberProfileRow(row: any | null, lookupKey: string) {
    if (!row) return;
    const at = Date.now();
    profileRowCache.set(lookupKey, { row, at });
    if (row.$id) profileRowCache.set(row.$id, { row, at });
    if (row.userId) profileRowCache.set(row.userId, { row, at });
    seedIdentityCache(row);
}

export function invalidateUsersProfileRowCache(userId?: string | null) {
  if (!userId) return;
  profileRowCache.delete(userId);
}

async function processProfileBatch() {
    const ids = Array.from(batchState.queue);
    batchState.queue.clear();
    const currentPromises = new Map(batchState.promises);
    batchState.promises.clear();
    batchState.timer = null;

    if (ids.length === 0) return;

    try {
        const { Query } = await import('appwrite');
        const res = await (tablesDB as any).listRows({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            queries: [
                Query.equal('userId', ids),
                Query.limit(ids.length),
            ],
        });

        const found = new Map<string, any>();
        res.rows.forEach((row: any) => {
            found.set(row.userId, row);
            found.set(row.$id, row);
            rememberProfileRow(row, row.userId);
        });

        ids.forEach(id => {
            const handlers = currentPromises.get(id);
            if (handlers) {
                const result = found.get(id) || null;
                handlers.forEach(h => h.resolve(result));
            }
        });
    } catch (e) {
        ids.forEach(id => {
            const handlers = currentPromises.get(id);
            if (handlers) handlers.forEach(h => h.reject(e));
        });
    }
}

async function syncProfileEvent(payload: {
    type: 'username_change' | 'profile_sync';
    userId: string;
    newUsername?: string | null;
    profilePatch?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}) {
    try {
        const res = await fetch(`${getEcosystemUrl('accounts')}/api/account-events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to sync profile event');
        return data;
    } catch (error) {
        console.warn('[VaultUsersService] Failed to sync profile event:', error);
        return null;
    }
}

export const UsersService = {
    async getProfileById(userId: string): Promise<any | null> {
        if (!userId) return null;

        // 1. Memory Cache
        const hit = profileRowCache.get(userId);
        if (hit && Date.now() - hit.at < PROFILE_ROW_TTL_MS) {
            return hit.row ? { ...hit.row } : null;
        }

        // 2. Batched Network Request
        return new Promise((resolve, reject) => {
            const existing = batchState.promises.get(userId);
            if (existing) {
                existing.push({ resolve, reject });
            } else {
                batchState.promises.set(userId, [{ resolve, reject }]);
                batchState.queue.add(userId);
            }

            if (!batchState.timer) {
                batchState.timer = setTimeout(processProfileBatch, 50);
            }
        });
    },

    async updateProfile(userId: string, data: any) {
        const profile = await this.getProfileById(userId);
        if (profile) {
            const result = await tablesDB.updateRow(
                DATABASE_ID,
                TABLE_ID,
                profile.$id,
                data
            );
            invalidateUsersProfileRowCache(userId);
            invalidateUsersProfileRowCache(profile.$id);
            if (result) {
                rememberProfileRow(result, userId);
                rememberProfileRow(result, result.$id);
                if (result.userId) rememberProfileRow(result, result.userId);
                seedIdentityCache(result);
            }
            await syncProfileEvent({
                type: Object.prototype.hasOwnProperty.call(data, 'username') ? 'username_change' : 'profile_sync',
                userId,
                newUsername: data.username || profile.username || null,
                profilePatch: {
                    username: data.username || profile.username,
                    displayName: data.displayName || profile.displayName,
                    bio: data.bio ?? profile.bio,
                    publicKey: data.publicKey ?? profile.publicKey,
                },
                metadata: {
                    source: 'vault.users-service.updateProfile',
                },
            });
            return result;
        }
        return null;
    },

    async createProfile(userId: string, username: string, data: any = {}) {
        return await tablesDB.createRow(
            DATABASE_ID,
            TABLE_ID,
            userId,
            {
                userId,
                username,
                displayName: data.displayName || username,
                publicKey: data.publicKey || null,
                avatar: data.avatar ?? null,
                bio: data.bio || ''
            },
            [
                Permission.read(Role.any()),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId))
            ]
        ).then(async (row: any) => {
            rememberProfileRow(row, userId);
            seedIdentityCache(row);
            await syncProfileEvent({
                type: 'username_change',
                userId,
                newUsername: username,
                profilePatch: {
                    username,
                    displayName: data.displayName || username,
                    bio: data.bio || '',
                    publicKey: data.publicKey || null,
                },
                metadata: {
                    source: 'chat.profiles-service.createProfile',
                },
            });
            return row;
        });
    },

    async isUsernameAvailable(username: string): Promise<boolean> {
        try {
            const { Query } = await import("appwrite");
            const res = await (tablesDB as any).listRows({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                queries: [
                    Query.equal('username', username.toLowerCase()),
                    Query.limit(1)
                ]
            });
            return res.rows.length === 0;
        } catch (_e) {
            return false;
        }
    },

    async ensureProfileForUser(user: any) {
        try {
            const existing = await this.getProfileById(user.$id);
            if (existing) return existing;
            
            // Generate a default username from email
            const email = user.email || user.name || 'user';
            const defaultUsername = email.split('@')[0].replace(/[^a-z0-9_]/g, '_').toLowerCase();
            
            // Check if username is available, if not add timestamp
            let username = defaultUsername;
            let attempts = 0;
            while (!(await this.isUsernameAvailable(username)) && attempts < 5) {
                username = `${defaultUsername}${Math.random().toString(36).substring(7)}`;
                attempts++;
            }
            
            return await this.createProfile(user.$id, username, {
                displayName: user.name || email,
            });
        } catch (error) {
            console.warn('[UsersService] Failed to ensure profile:', error);
            return null;
        }
    },

    async searchUsers(query: string, options?: { requirePublicKey?: boolean }) {
        try {
            const { Query } = await import("appwrite");
            const queries = [
                Query.or([
                    Query.startsWith('username', query.toLowerCase()),
                    Query.startsWith('displayName', query),
                ]),
                Query.limit(20)
            ];
            
            if (options?.requirePublicKey) {
                queries.push(Query.notEqual('publicKey', ''));
            }
            
            const res = await (tablesDB as any).listRows({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                queries
            });
            return res.rows || [];
        } catch (error) {
            console.warn('[UsersService] Search failed:', error);
            return [];
        }
    },

    async getProfile(username: string) {
        try {
            const { Query } = await import("appwrite");
            const res = await (tablesDB as any).listRows({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                queries: [
                    Query.equal('username', username.toLowerCase()),
                    Query.limit(1)
                ]
            });
            return res.rows?.[0] || null;
        } catch (error) {
            console.warn('[UsersService] Get profile by username failed:', error);
            return null;
        }
    },

    async forceSyncProfileWithIdentity(user: any) {
        try {
            const existing = await this.getProfileById(user.$id);
            if (existing) return existing;
            
            return await this.ensureProfileForUser(user);
        } catch (error) {
            console.warn('[UsersService] Force sync failed:', error);
            return null;
        }
    },

    /**
     * Toggle global discoverability: Role.any read on profile row enables directory / username search surfacing.
     */
    async setProfileDiscoverable(userId: string, isDiscoverable: boolean) {
        const profile = await this.getProfileById(userId);
        if (!profile) throw new Error('Profile not found');

        const permissions = [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ];

        if (isDiscoverable) {
            permissions.push(Permission.read(Role.any()));
        }

        const updated = await tablesDB.updateRow(DATABASE_ID, TABLE_ID, profile.$id, {}, permissions);
        invalidateUsersProfileRowCache(userId);
        invalidateUsersProfileRowCache(profile.$id);
        if (updated) {
            rememberProfileRow(updated, userId);
            rememberProfileRow(updated, updated.$id);
            if (updated.userId) rememberProfileRow(updated, updated.userId);
            seedIdentityCache(updated);
        }
        return updated;
    },

    /**
     * Toggle whether the profile picture file in storage is readable by guests (search / public cards).
     */
    async setAvatarVisible(userId: string, fileId: string, isVisible: boolean) {
        const bucketId = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

        const permissions = [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ];

        if (isVisible) {
            permissions.push(Permission.read(Role.any()));
        }

        await storage.updateFile(bucketId, fileId, undefined, permissions);

        return await this.updateProfile(userId, { avatar: fileId });
    }

};
