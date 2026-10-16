/**
 * Ensures the user has a record in the global Kylrix Connect Directory.
 * This is the 'Universal Identity Hook' that enables ecosystem discovery.
 */

/**
 * Searches for users across the entire ecosystem via the global directory.
 * Supports email, username, and display name.
 */
export async function searchGlobalUsers(query: string, limit = 10, callerUserId?: string) {
    const cleaned = query.trim().replace(/^@/, '');
    if (!query || cleaned.length < 1) return [];

    const isEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
    if (isEmailQuery) {
        try {
            const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
            const rows = await searchGlobalUsersSecure(cleaned, limit, callerUserId);
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
        const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
        const secureRows = await searchGlobalUsersSecure(cleaned, limit);
        if (Array.isArray(secureRows) && secureRows.length > 0) {
            return secureRows.map((doc: any) => ({
                id: doc.$id || doc.id || doc.userId,
                userId: doc.$id || doc.userId || doc.id,
                type: 'user' as const,
                displayName: doc.displayName || null,
                title: doc.displayName || (doc.username ? `@${doc.username}` : 'Kylrix User'),
                subtitle: doc.username ? `@${doc.username}` : doc.email || '',
                icon: 'person',
                avatar: doc.avatar || null,
                createdAt: doc.$createdAt || doc.createdAt || null,
                lastUsernameEdit: doc.last_username_edit || null,
                username: doc.username || null,
                bio: doc.bio || null,
                tier: doc.tier || null,
                publicKey: doc.publicKey || null,
                email: doc.email || null,
                apps: doc.appsActive || [],
            }));
        }
    } catch (e: any) {
        console.warn('[Identity] Secure search failed:', e?.message);
    }

    return [];
}
