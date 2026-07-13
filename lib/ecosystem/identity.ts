import { databases, CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, Query, Permission, Role } from '../appwrite';
import { getEcosystemUrl } from '@/constants/ecosystem';

const PROFILE_SYNC_KEY = 'kylrix_identity_synced_v2';
const SESSION_SYNC_KEY = 'kylrix_session_identity_ok';

/**
 * Ensures the user has a record in the global Kylrix Connect Directory.
 * This is the 'Universal Identity Hook' that enables ecosystem discovery.
 */
export async function ensureGlobalIdentity(user: any, force = false) {
    if (!user?.$id || typeof window === 'undefined') return;

    // Layered Caching
    if (!force && sessionStorage.getItem(SESSION_SYNC_KEY)) return;
    const lastSync = localStorage.getItem(PROFILE_SYNC_KEY);
    if (!force && lastSync && (Date.now() - parseInt(lastSync)) < 24 * 60 * 60 * 1000) {
        sessionStorage.setItem(SESSION_SYNC_KEY, '1');
        return;
    }

    try {
        const syncProfileEvent = async (payload: {
            type: 'username_change' | 'profile_sync';
            userId: string;
            newUsername?: string | null;
            profilePatch?: Record<string, unknown>;
            metadata?: Record<string, unknown>;
        }) => {
            try {
                const { createAccountEventSecure } = await import('@/lib/actions/secure-ops');
                return await createAccountEventSecure(payload);
            } catch (error) {
                console.warn('[Identity] Failed to sync profile event:', error);
                return null;
            }
        };

        const { account } = await import('../appwrite');
        const [prefs, profile] = await Promise.all([
            account.getPrefs(),
            databases.getRow(CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, user.$id).catch(() => null)
        ]);

        let username = user.username || prefs?.username || user.name || user.email?.split('@')[0];
        username = String(username).toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 50);
        if (!username) username = `user_${user.$id.slice(0, 8)}`;

        const picId = user.avatar || user.profilePicId || user.avatarUrl || prefs?.profilePicId || null;
        const profileData: any = {
            username,
            displayName: user.name || username,
            updatedAt: new Date().toISOString(),
            walletAddress: user.walletAddress || null,
            bio: profile?.bio || "",
            avatar: picId
        };

        if (!profile) {
            try {
                const payload = {
                    ...profileData,
                    createdAt: new Date().toISOString()
                };

                await databases.createRow(CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, user.$id, payload, [
                    Permission.read(Role.any())]);
                await syncProfileEvent({
                    type: 'username_change',
                    userId: user.$id,
                    newUsername: username,
                    profilePatch: payload,
                    metadata: {
                        source: 'note.ensureGlobalIdentity.create',
                    },
                });
            } catch (inner: any) {
                console.error('[Identity] Global profile creation failed:', inner);
                throw inner;
            }
        } else {
            if (profile.username !== username || profile.avatar !== picId || profile.displayName !== profileData.displayName) {
                try {
                    const payload = { ...profileData };
                    await databases.updateRow(CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, user.$id, payload);
                    await syncProfileEvent({
                        type: profile.username !== username ? 'username_change' : 'profile_sync',
                        userId: user.$id,
                        newUsername: username,
                        profilePatch: payload,
                        metadata: {
                            source: 'note.ensureGlobalIdentity.update',
                        },
                    });
                } catch (inner: any) {
                    console.error('[Identity] Global profile update failed:', inner);
                    throw inner;
                }
            }
        }

        if (prefs.username !== username) {
            await account.updatePrefs({ ...prefs, username });
            await syncProfileEvent({
                type: 'username_change',
                userId: user.$id,
                newUsername: username,
                profilePatch: {
                    username,
                    displayName: profileData.displayName,
                    bio: profileData.bio,
                    avatar: picId,
                    walletAddress: user.walletAddress || null,
                },
                metadata: {
                    source: 'note.ensureGlobalIdentity.prefs',
                },
            });
        }

        localStorage.setItem(PROFILE_SYNC_KEY, Date.now().toString());
        sessionStorage.setItem(SESSION_SYNC_KEY, '1');
    } catch (error: any) {
        console.warn('[Identity] Background sync deferred:', error);
    }
}

/**
 * Searches for users across the entire ecosystem via the global directory.
 * Supports email, username, and display name.
 */
export async function searchGlobalUsers(query: string, limit = 10) {
    const cleaned = query.trim().replace(/^@/, '');
    if (!query || cleaned.length < 1) return [];

    const isEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
    if (isEmailQuery) {
        try {
            const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
            const rows = await searchGlobalUsersSecure(cleaned, limit);
            return rows.map((doc: any) => ({
                id: doc.$id || doc.id || doc.userId,
                userId: doc.userId || doc.$id || doc.id,
                type: 'user' as const,
                displayName: doc.displayName || null,
                username: doc.username || null,
                title: doc.displayName || (doc.username ? `@${doc.username}` : 'Kylrix User'),
                subtitle: doc.email || cleaned,
                email: doc.email || cleaned,
                icon: 'person',
                avatar: doc.avatar || null,
                createdAt: doc.$createdAt || doc.createdAt || null,
                lastUsernameEdit: doc.last_username_edit || null,
                bio: doc.bio || null,
                tier: doc.tier || null,
                publicKey: doc.publicKey || null,
                apps: doc.appsActive || [],
            }));
        } catch (error: any) {
            console.warn('[Identity] Email search failed:', error?.message);
            return [];
        }
    }

    try {
        // 1. Primary search: ONLY username (indexed)
        let results: any[] = [];
        try {
            const queries = [
                Query.or([
                    Query.startsWith('username', cleaned.toLowerCase()),
                    Query.startsWith('displayName', cleaned)
                ]),
                Query.limit(limit),
                Query.select(['$id', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey'])
            ];

            const res = await databases.listRows(
                CONNECT_DATABASE_ID,
                CONNECT_TABLE_ID_USERS,
                queries
            );
            results = res.rows.map(doc => ({
                id: doc.$id,
                userId: doc.$id,
                type: 'user' as const,
                displayName: doc.displayName || null,
                title: doc.displayName || (doc.username ? `@${doc.username}` : 'Kylrix User'),
                subtitle: doc.username ? `@${doc.username}` : '',
                icon: 'person',
                avatar: doc.avatar,
                createdAt: doc.$createdAt || doc.createdAt || null,
                lastUsernameEdit: doc.last_username_edit || null,
                username: doc.username || null,
                bio: doc.bio || null,
                tier: doc.tier || null,
                publicKey: doc.publicKey || null,
                apps: doc.appsActive || []
            }));
        } catch (e: any) {
            console.warn('[Identity] Username search failed:', e);
            // Fallback for older Appwrite versions that don't support Query.or if needed
            if (e.message?.includes('Query.or')) {
                const res = await databases.listRows(
                    CONNECT_DATABASE_ID,
                    CONNECT_TABLE_ID_USERS,
                    [
                        Query.startsWith('username', cleaned.toLowerCase()),
                        Query.limit(limit),
                        Query.select(['$id', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey'])
                    ]
                );
                results = res.rows.map(doc => ({
                    id: doc.$id,
                    userId: doc.$id,
                    type: 'user' as const,
                    displayName: doc.displayName || null,
                    title: doc.displayName || (doc.username ? `@${doc.username}` : 'Kylrix User'),
                    subtitle: doc.username ? `@${doc.username}` : '',
                    icon: 'person',
                    avatar: doc.avatar,
                    createdAt: doc.$createdAt || doc.createdAt || null,
                    lastUsernameEdit: doc.last_username_edit || null,
                    username: doc.username || null,
                    bio: doc.bio || null,
                    tier: doc.tier || null,
                    publicKey: doc.publicKey || null,
                    apps: doc.appsActive || []
                }));
            }
        }

        // 2. Secondary Fallback: Search by 'name' (Fulltext index in note table)
        if (results.length < 5) {
            try {
                const noteRes = await databases.listRows(
                    CONNECT_DATABASE_ID,
                    CONNECT_TABLE_ID_USERS,
                    [
                        Query.search('displayName', cleaned),
                        Query.limit(5)
                    ]
                );

                for (const doc of noteRes.rows) {
                    if (!results.find(r => r.id === doc.$id)) {
                        results.push({
                            id: doc.$id,
                            userId: doc.$id,
                            type: 'user' as const,
                            displayName: doc.displayName || null,
                            title: doc.displayName || (doc.username ? `@${doc.username}` : 'Kylrix User'),
                            subtitle: doc.username ? `@${doc.username}` : '',
                            icon: 'person',
                            avatar: doc.avatar || null,
                            createdAt: doc.$createdAt || doc.createdAt || null,
                            lastUsernameEdit: doc.last_username_edit || null,
                            username: doc.username || null,
                            bio: doc.bio || null,
                            tier: doc.tier || null,
                            publicKey: doc.publicKey || null,
                            apps: ['note']
                        });
                    }
                }
            } catch (_err: any) {
                // Ignore fallback errors
            }
        }

        return results;
    } catch (error: any) {
        console.error('[Identity] Global search failed:', error);
        return [];
    }
}
