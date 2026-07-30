import { databases, CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, Query } from '../appwrite';


/**
 * Ensures the user has a record in the global Kylrix Connect Directory.
 * This is the 'Universal Identity Hook' that enables ecosystem discovery.
 */

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
                apps: doc.appsActive || []}));
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
            results = res.rows.map((doc: any) => ({
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
                results = res.rows.map((doc: any) => ({
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
                    if (!results.find((r: any) => r.id === doc.$id)) {
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
