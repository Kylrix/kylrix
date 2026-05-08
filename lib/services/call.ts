import { ID, Permission, Query, Role } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { createCallMetadata, parseCallMetadata, type KylrixCallScope } from '@/lib/sdk/calls';

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
        // Legacy helper name kept for compatibility:
        // calls are identified by row $id in the live schema (no "code" column).
        return await this.getCallLink(code);
    },

    async createCallLink(
        userId: string,
        type: 'audio' | 'video' = 'video',
        conversationId?: string,
        title?: string,
        startsAt?: string,
        durationMinutes: number = 120,
        metadata?: string,
    ) {
        try {
            // Default to starting now if not provided
            const startTime = startsAt ? new Date(startsAt) : new Date();
            // Expire based on duration (default 2 hours)
            const expiresAt = new Date(startTime.getTime() + durationMinutes * 60 * 1000).toISOString();

            // Live "calls" schema does not include a "code" attribute.
            const payload: any = {
                userId,
                type,
                expiresAt,
                startsAt: startTime.toISOString(),
            };

            if (title) payload.title = title;
            if (metadata) payload.metadata = metadata;
            else if (conversationId) payload.metadata = JSON.stringify({ conversationId });
            if (conversationId) payload.conversationId = conversationId;

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

    async createScopedCallLink(input: {
        userId: string;
        type?: 'audio' | 'video';
        title?: string;
        startsAt?: string;
        durationMinutes?: number;
        scope: KylrixCallScope;
        sourceApp?: 'connect' | 'note' | 'flow';
        conversationId?: string;
        noteId?: string;
        taskId?: string;
        participantIds?: string[];
        isPrivate?: boolean;
        allowGuests?: boolean;
    }) {
        const metadata = createCallMetadata({
            scope: input.scope,
            hostId: input.userId,
            sourceApp: input.sourceApp,
            conversationId: input.conversationId,
            noteId: input.noteId,
            huddleId: input.taskId,
            participantIds: input.participantIds || [],
            isPrivate: input.isPrivate ?? true,
            allowGuests: input.allowGuests ?? false,
            startsAt: input.startsAt || null,
            expiresAt: null,
            title: input.title,
        });

        return this.createCallLink(
            input.userId,
            input.type || 'video',
            input.conversationId,
            input.title,
            input.startsAt,
            input.durationMinutes ?? 120,
            metadata,
        );
    },

    canUserJoinCall(callRow: any, userId?: string | null) {
        const metadata = parseCallMetadata(callRow?.metadata);
        const participants = Array.isArray(metadata.participantIds) ? metadata.participantIds : [];
        const isPrivate = Boolean(metadata.isPrivate);

        if (!isPrivate || participants.length === 0) return true;
        if (!userId) return false;
        return participants.includes(userId);
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
    },

    async getCallHistory(userId: string) {
        try {
            const res = await tablesDB.listRows({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                queries: [
                    Query.or([
                        Query.equal('userId', userId),
                        Query.equal('callerId', userId),
                        Query.equal('receiverId', userId),
                    ]),
                    Query.limit(50)
                ],
            });
            return res.rows || [];
        } catch (_e) {
            return [];
        }
    },

    async getActiveCalls(userId: string) {
        try {
            const res = await tablesDB.listRows({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                queries: [
                    Query.or([
                        Query.equal('userId', userId),
                        Query.equal('callerId', userId),
                        Query.equal('receiverId', userId),
                    ]),
                    Query.equal('status', 'active'),
                    Query.limit(50)
                ],
            });
            return res.rows || [];
        } catch (_e) {
            return [];
        }
    },

    async deleteCallLog(callId: string) {
        try {
            await tablesDB.deleteRow({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                rowId: callId,
            });
        } catch (_e) {
            return;
        }
    },

    async endCall(callId: string) {
        try {
            await tablesDB.updateRow({
                databaseId: DB_ID,
                tableId: APPWRITE_CONFIG.TABLES.CHAT.CALL_LOGS,
                rowId: callId,
                data: {
                    status: 'ended',
                    endedAt: new Date().toISOString(),
                },
            });
        } catch (_e) {
            return;
        }
    }
};
