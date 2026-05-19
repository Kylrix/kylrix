import { ID, Permission, Query, Role } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { createCallMetadata, parseCallMetadata, type KylrixCallScope } from '@/lib/sdk/calls';
import { getNamedListCache } from './list-cache';

import { ActivityService } from './activity';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

const historyCache = getNamedListCache<any[]>('call_history', 60000);
const activeCallsCache = getNamedListCache<any[]>('active_calls', 10000); // 10s for active calls

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
        allowGuests: boolean = true,
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

            const permissions = [
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ];

            if (allowGuests) {
                permissions.push(Permission.read(Role.any()));
            } else {
                permissions.push(Permission.read(Role.users()));
            }

            const result = await tablesDB.createRow({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                rowId: ID.unique(),
                data: payload,
                permissions
            });

            historyCache.invalidate();
            activeCallsCache.invalidate();

            return result;
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
            input.allowGuests ?? false
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
        // Since we don't have a call_logs table, we can't easily track active participants
        // in a persistent way without a separate table. For now, returning empty.
        // Presence is handled by the 'app_activity' table in the activity service.
        return [];
    },

    async createAnonymousSession() {
        try {
            const { account } = await import('../appwrite/client');
            return await account.createAnonymousSession();
        } catch (_e) {
            return {
                $id: ID.unique(),
                createdAt: new Date().toISOString(),
            };
        }
    },

    async sendSignal(senderId: string, targetId: string, signal: Record<string, unknown>) {
        try {
            // Signals are now sent via the 'app_activity' table for transient handshakes.
            // This prevents polluting chat history and stops generic message notifications.
            await ActivityService.updatePresence(senderId, 'busy', JSON.stringify({ 
                ...signal, 
                target: targetId,
                sender: senderId,
                ts: Date.now() 
            }));
        } catch (_e) {
            console.error('[CallService] sendSignal failed:', _e);
        }
    },

    async getCallHistory(userId: string, force = false) {
        return historyCache.fetch(async () => {
            try {
                const res = await tablesDB.listRows({
                    databaseId: DB_ID,
                    tableId: LINKS_TABLE,
                    queries: [
                        Query.or([
                            Query.equal('userId', userId),
                            Query.equal('receiverId', userId),
                        ]),
                        Query.limit(50),
                        Query.orderDesc('startsAt')
                    ],
                });
                
                return (res.rows || []).map(row => ({
                    ...row,
                    isLink: true,
                    status: new Date(row.expiresAt).getTime() > Date.now() ? 'active' : 'ended',
                    startedAt: row.startsAt,
                    callerId: row.userId,
                }));
            } catch (_e) {
                return [];
            }
        }, force);
    },

    async getActiveCalls(userId: string, force = false) {
        return activeCallsCache.fetch(async () => {
            try {
                const res = await tablesDB.listRows({
                    databaseId: DB_ID,
                    tableId: LINKS_TABLE,
                    queries: [
                        Query.or([
                            Query.equal('userId', userId),
                            Query.equal('receiverId', userId),
                        ]),
                        Query.greaterThanEqual('expiresAt', new Date().toISOString()),
                        Query.limit(50)
                    ],
                });

                return (res.rows || []).map(row => ({
                    ...row,
                    isLink: true,
                    status: 'active',
                    startedAt: row.startsAt,
                    callerId: row.userId,
                })).filter(link => new Date(link.startsAt).getTime() <= Date.now());
            } catch (_e) {
                return [];
            }
        }, force);
    },

    async deleteCall(callId: string) {
        try {
            await tablesDB.deleteRow({
                databaseId: DB_ID,
                tableId: LINKS_TABLE,
                rowId: callId,
            });
            historyCache.invalidate();
            activeCallsCache.invalidate();
        } catch (_e) {
            return;
        }
    }
};
