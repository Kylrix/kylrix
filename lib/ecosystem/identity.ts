import { databases, CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, Query, Permission, Role } from '../appwrite';
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
                console.warn('[Identity] Failed to sync profile event:', error);
                return null;
            }
        };

        const { account } = await import('../appwrite');
        const [prefs, profile] = await Promise.all([
            account.getPrefs(),
            databases.getDocument(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, user.$id).catch(() => null)
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

                await databases.createDocument(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, user.$id, payload, [
                    Permission.read(Role.any()),
                    Permission.update(Role.user(user.$id)),
                    Permission.delete(Role.user(user.$id))
                ]);
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
                    await databases.updateDocument(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, user.$id, payload);
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

            const res = await databases.listDocuments(
                CONNECT_DATABASE_ID,
                CONNECT_COLLECTION_ID_USERS,
                queries
            );
            results = res.documents.map(doc => ({
                id: doc.$id,
                type: 'user' as const,
                title: doc.displayName || doc.username,
                subtitle: `@${doc.username}`,
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
                const res = await databases.listDocuments(
                    CONNECT_DATABASE_ID,
                    CONNECT_COLLECTION_ID_USERS,
                    [
                        Query.startsWith('username', cleaned.toLowerCase()),
                        Query.limit(limit),
                        Query.select(['$id', 'username', 'displayName', 'bio', 'avatar', 'walletAddress', 'publicKey'])
                    ]
                );
                results = res.documents.map(doc => ({
                    id: doc.$id,
                    type: 'user' as const,
                    title: doc.displayName || doc.username,
                    subtitle: `@${doc.username}`,
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
                const noteRes = await databases.listDocuments(
                    CONNECT_DATABASE_ID,
                    CONNECT_COLLECTION_ID_USERS,
                    [
                        Query.search('displayName', cleaned),
                        Query.limit(5)
                    ]
                );

                for (const doc of noteRes.documents) {
                    if (!results.find(r => r.id === doc.$id)) {
                        results.push({
                            id: doc.$id,
                            type: 'user' as const,
                            title: doc.name || doc.email?.split('@')[0] || doc.$id.slice(0, 8),
                            subtitle: doc.username ? `@${doc.username}` : doc.email,
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
