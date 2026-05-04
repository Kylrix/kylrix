import { tablesDB } from '../appwrite';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getEcosystemUrl } from '../constants/ecosystem';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const TABLE_ID = APPWRITE_CONFIG.TABLES.VAULT.USER; // 'user' table in chat DB is used for profiles

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
    async getProfileById(userId: string) {
        try {
            return await tablesDB.getRow({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                rowId: userId
            });
        } catch (_e: any) {
            try {
                const { Query } = await import("appwrite");
                const res = await (tablesDB as any).listRows({
                    databaseId: DATABASE_ID,
                    tableId: TABLE_ID,
                    queries: [
                        Query.or([
                            Query.equal('userId', userId),
                            Query.equal('$id', userId)
                        ]),
                        Query.limit(1)
                    ]
                });
                return res.rows[0] || null;
            } catch (_inner) {
                return null;
            }
        }
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
        const { Permission, Role } = await import("appwrite");
        return await tablesDB.createRow(
            DATABASE_ID,
            TABLE_ID,
            userId,
            {
                userId,
                username,
                displayName: data.displayName || username,
                appsActive: data.appsActive || ['vault'],
                publicKey: data.publicKey || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                bio: data.bio || ''
            },
            [
                Permission.read(Role.any()),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId))
            ]
        ).then(async (row: any) => {
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
                    source: 'vault.users-service.createProfile',
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

    async searchUsers(query: string) {
        try {
            const { Query } = await import("appwrite");
            const res = await (tablesDB as any).listRows({
                databaseId: DATABASE_ID,
                tableId: TABLE_ID,
                queries: [
                    Query.or([
                        Query.startsWith('username', query.toLowerCase()),
                        Query.startsWith('displayName', query),
                    ]),
                    Query.limit(20)
                ]
            });
            return res.rows || [];
        } catch (error) {
            console.warn('[UsersService] Search failed:', error);
            return [];
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
    }

};
