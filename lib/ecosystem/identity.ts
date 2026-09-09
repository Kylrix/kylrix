import { databases, CONNECT_DATABASE_ID, CONNECT_TABLE_ID_USERS, Query } from '../appwrite';
import { bytesToHex, hexToBytes, bytesToNpub, npubToBytes } from '@/lib/nostr/crypto';

/**
 * Ensures the user has a record in the global Kylrix Connect Directory.
 * This is the 'Universal Identity Hook' that enables ecosystem discovery.
 */

/**
 * Searches for users across the entire ecosystem via the global directory.
 * Supports email, username, display name, and Nostr npub / public key.
 */
export async function searchGlobalUsers(query: string, limit = 10) {
    const cleaned = query.trim().replace(/^@/, '');
    if (!query || cleaned.length < 1) return [];

    // Check if query is a Nostr public key or npub
    const isNpub = cleaned.startsWith('npub1') && cleaned.length >= 50;
    const isHexNostr = /^[0-9a-fA-F]{64}$/.test(cleaned);

    if (isNpub || isHexNostr) {
        try {
            let npub = cleaned;
            let pubkeyHex = cleaned;

            if (isNpub) {
                try {
                    pubkeyHex = bytesToHex(npubToBytes(cleaned));
                } catch {
                    pubkeyHex = cleaned;
                }
            } else if (isHexNostr) {
                try {
                    npub = bytesToNpub(hexToBytes(cleaned.toLowerCase()));
                    pubkeyHex = cleaned.toLowerCase();
                } catch {
                    npub = cleaned;
                }
            }

            const { resolveNostrPubkeysAction } = await import('@/lib/actions/secure-ops/nostr');
            const resolvedMap: Record<string, any> = await resolveNostrPubkeysAction([npub]).catch(() => ({}));

            const ecosystemProfile = resolvedMap[npub];

            if (ecosystemProfile?.userId) {
                const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
                const userDocs = await searchGlobalUsersSecure(ecosystemProfile.userId, 1).catch(() => []);
                const userDoc = Array.isArray(userDocs) && userDocs.length > 0 ? userDocs[0] : null;

                return [{
                    id: ecosystemProfile.userId,
                    userId: ecosystemProfile.userId,
                    type: 'user' as const,
                    displayName: userDoc?.displayName || ecosystemProfile.username || 'Kylrix User',
                    username: userDoc?.username || ecosystemProfile.username || null,
                    title: userDoc?.displayName || (userDoc?.username ? `@${userDoc.username}` : ecosystemProfile.username || 'Kylrix User'),
                    subtitle: `Nostr npub: ${npub.slice(0, 12)}…`,
                    avatar: userDoc?.avatar || ecosystemProfile.avatarUrl || null,
                    viaNpub: true,
                    isEcosystemUser: true,
                    isNostrOnly: false,
                    nostrNpub: npub,
                    nostrPubkeyHex: pubkeyHex,
                    publicKey: userDoc?.publicKey || null,
                    apps: userDoc?.appsActive || []
                }];
            }

            return [{
                id: npub,
                userId: npub,
                type: 'user' as const,
                displayName: `npub…${npub.slice(-8)}`,
                username: `npub…${npub.slice(-8)}`,
                title: `npub…${npub.slice(-8)}`,
                subtitle: 'Nostr Public Key (External)',
                avatar: null,
                viaNpub: true,
                isNostrOnly: true,
                isEcosystemUser: false,
                nostrNpub: npub,
                nostrPubkeyHex: pubkeyHex,
                apps: []
            }];
        } catch (e: any) {
            console.warn('[Identity] Nostr npub search failed:', e?.message);
        }
    }

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

    // Primary: secure directory search via system client (bypasses RLS, respects isPublic)
    // This fixes "no results" where client-side listRows is blocked by rowSecurity.
    try {
        const { searchGlobalUsersSecure } = await import('@/lib/actions/secure-ops');
        const secureRows = await searchGlobalUsersSecure(cleaned, limit);
        if (Array.isArray(secureRows) && secureRows.length > 0) {
            // Normalize secure rows to same shape as direct search
            const mapped = secureRows.map((doc: any) => ({
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
            if (mapped.length >= 1) return mapped;
        }
    } catch (e: any) {
        console.warn('[Identity] Secure search failed, falling back to client query:', e?.message);
    }

    try {
        // Fallback client-side search: ONLY username (indexed)
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
            } catch (_err: any) {}
        }

        return results;
    } catch (error: any) {
        console.error('[Identity] Global search failed:', error);
        return [];
    }
}
