import { ID, Permission, Query, Role } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

export const CallService = {
    async getCallLink(id: string) {
        try {
            return await tablesDB.getRow({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                rowId: id,
            });
        } catch (_e) {
            return null;
        }
    },

    async getCallLinkByCode(code: string) {
        try {
            const res = await tablesDB.listRows({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                queries: [Query.equal('code', code), Query.limit(1)],
            });
            return res.rows[0] || null;
        } catch (_e) {
            return await this.getCallLink(code);
        }
    },

    async createCallLink(userId: string, type: 'audio' | 'video' = 'video', conversationId?: string, title?: string, startsAt?: string, durationMinutes: number = 120) {
        try {
            // Default to starting now if not provided
            const startTime = startsAt ? new Date(startsAt) : new Date();
            // Expire based on duration (default 2 hours)
            const expiresAt = new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString();

            // Create the row with the new concise structure
            const payload: any = {
                userId,
                type,
                expiresAt,
                startsAt: startTime.toISOString(),
                code: ID.unique()
            };

            if (title) payload.title = title;
            if (conversationId) payload.metadata = JSON.stringify({ conversationId });

            console.log('[CallService] Creating call in new table with payload:', payload);

            return await tablesDB.createRow({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                rowId: ID.unique(),
                data: payload,
                permissions: [
                    Permission.read(Role.any()),
                    Permission.update(Role.user(userId)),
                    Permission.delete(Role.user(userId)),
                ]
            });
        } catch (_e) {
            console.error('[CallService] createCallLink failed:', _e);
            throw _e;
        }
    },

    async cleanupLink(id: string) {
        try {
            await tablesDB.deleteRow({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                rowId: id,
            });
        } catch (_e) {
            return;
        }
    },

    async getActiveParticipants(callId: string) {
        try {
            const res = await tablesDB.listRows({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                queries: [Query.equal('callId', callId)],
            });
            return res.rows || [];
        } catch (_e) {
            return [];
        }
    },

    async createAnonymousSession() {
        return {
            $id: ID.unique(),
            createdAt: new Date().toISOString(),
        };
    },

    async sendSignal(senderId: string, targetId: string, signal: Record<string, unknown>) {
        try {
            await tablesDB.createRow({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                rowId: ID.unique(),
                data: {
                    senderId,
                    targetId,
                    signal,
                    createdAt: new Date().toISOString(),
                },
            });
        } catch (_e) {
            return;
        }
    }
};
