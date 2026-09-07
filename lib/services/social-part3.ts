import { ID, Query } from 'appwrite';
import { tablesDB, realtime, storage } from '../appwrite/client';
import { UsersService } from './users';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getCachedMomentPreview, seedMomentPreview } from '../moment-preview';
import { getCachedMomentThread } from '../moment-thread-cache';
import { getTablesDbRowCached } from '../ecosystem/tablesdb-row-cache';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const MOMENTS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
const FOLLOWS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.FOLLOWS;
const INTERACTIONS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.INTERACTIONS;
const MOMENT_LIST_SELECT = ['$id', 'userId', 'caption', 'fileId', 'momentKind', 'sourceId', 'searchTitle', 'createdAt', 'expiresAt', 'isPublic', 'isGuest', 'nostrId', 'attachments'];
const INTERACTION_LIST_SELECT = ['$id', 'userId', 'messageId', 'emoji', 'createdAt'];

                        // For someone else's "following" list, we need to check.
                        if (currentUserId === userId) {
                            isFollowing = true;
                        } else {
                            isFollowing = await this.isFollowing(currentUserId, profile.userId || profile.$id);
                        }
                    }

                    return { ...profile, followRowId: row.$id, isFollowing };
                })
            );

            return profiles.filter(p => p !== null);
        } catch (error) {
            console.error('[SocialService] getFollowing error', error);
            return [];
        }
    },

    async searchMoments(query: string, userId?: string) {
        try {
            const queries = [
                Query.select(MOMENT_LIST_SELECT),
                Query.search('searchTitle', query),
                Query.orderDesc('$createdAt'),
                Query.limit(50)
            ];

            const moments = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, queries);
            
            // Enrich search results
            const enrichedRows = await Promise.all(moments.rows.map(async (moment: any) => {
                return this.enrichMoment(moment, userId);
            }));

            return { ...moments, rows: enrichedRows };
        } catch (error) {
            console.error('searchMoments error:', error);
            return { rows: [], total: 0 };
        }
    },

    async getMomentById(momentId: string, currentUserId?: string) {
        const cachedThread = getCachedMomentThread(momentId);
        if (cachedThread?.moment) return cachedThread.moment;

        const cachedPreview = getCachedMomentPreview(momentId);
        if (cachedPreview) return cachedPreview;

        const moment = await tablesDB.getRow(DB_ID, MOMENTS_TABLE, momentId);
        const enriched = await this.enrichMoment(moment, currentUserId);
        seedMomentPreview(enriched);
        return enriched;
    },

    async getUserReplies(userId: string, currentUserId?: string) {
        try {
            const moments = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                Query.select(MOMENT_LIST_SELECT),
                Query.equal('userId', userId),
                Query.equal('momentKind', 'reply'),
                Query.orderDesc('$createdAt'),
                Query.limit(100),
            ]);
            const rows = moments.rows || [];
            return rows.length
                ? Promise.all(rows.map((m: any) => this.enrichMoment(m, currentUserId)))
                : [];
        } catch (error) {
            console.error('[SocialService] getUserReplies error', error);
            return [];
        }
    },

    async getUserLikedMoments(userId: string, currentUserId?: string) {
        try {
            const interactions = await tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
                Query.select(INTERACTION_LIST_SELECT),
                Query.equal('userId', userId),
                Query.equal('emoji', 'like'),
                Query.orderDesc('$createdAt'),
                Query.limit(120),
            ]);
            const likedAt = new Map<string, string>();
            const momentIds: string[] = [];
            for (const row of interactions.rows || []) {
                if (!row?.messageId || likedAt.has(row.messageId)) continue;
                likedAt.set(row.messageId, row.createdAt || row.$createdAt || '');
                momentIds.push(row.messageId);
            }
            if (!momentIds.length) return [];

            const moments = await fetchRowsByIds(DB_ID, MOMENTS_TABLE, momentIds);
            const enriched = await Promise.all(
                moments.map((m: any) => this.enrichMoment(m, currentUserId)),
            );
            return enriched.sort((a: any, b: any) => {
                const aTime = new Date(likedAt.get(a.$id) || a.$createdAt || 0).getTime();
                const bTime = new Date(likedAt.get(b.$id) || b.$createdAt || 0).getTime();
                return bTime - aTime;
            });
        } catch (error) {
            console.error('[SocialService] getUserLikedMoments error', error);
            return [];
        }
    },

    async getReplies(momentId: string, currentUserId?: string) {
        const cachedThread = getCachedMomentThread(momentId);
        if (cachedThread?.replies?.length) return cachedThread.replies;

        const moments = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
            Query.select(MOMENT_LIST_SELECT),
            Query.equal('sourceId', momentId),
            Query.equal('momentKind', 'reply'),
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ]).catch(() => ({ rows: [] as any[] }));

        const replies = moments.rows.length
            ? await Promise.all(moments.rows.map(m => this.enrichMoment(m, currentUserId)))
            : await Promise.all((await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                Query.select(MOMENT_LIST_SELECT),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]).catch(() => ({ rows: [] as any[] }))).rows
                .filter((m: any) => getMomentKind(m) === 'reply' && getMomentSourceId(m) === momentId)
                .map(m => this.enrichMoment(m, currentUserId)));

        return replies;
    }
};
