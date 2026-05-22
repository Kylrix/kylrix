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
        approveParticipants?: boolean;
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
            approveParticipants: input.approveParticipants ?? false,
            startsAt: input.startsAt || null,
            expiresAt: null,
            title: input.title,
        } as any);

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
        try {
            const ACTIVITY_TABLE = APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY;
            const res = await tablesDB.listRows({
                databaseId: DB_ID,
                tableId: ACTIVITY_TABLE,
                queries: [
                    Query.limit(100),
                ]
            });
            const active: any[] = [];
            for (const row of res.rows) {
                if (row.customStatus) {
                    try {
                        const parsed = JSON.parse(row.customStatus);
                        if (parsed.t === 'call' && parsed.id === callId && parsed.s === 'live') {
                            active.push({
                                userId: row.userId,
                                lastSeen: row.lastSeen,
                                status: row.status,
                            });
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            return active;
        } catch (e) {
            console.error('[CallService] getActiveParticipants failed:', e);
            return [];
        }
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
                })).filter(link => new Date(link.startedAt).getTime() <= Date.now());
            } catch (_e) {
                return [];
            }
        }, force);
    },

    async createGhostNoteForCall(userId: string, callId: string, title?: string) {
        try {
            const { databases } = await import('../appwrite/client');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const metadata = JSON.stringify({
                isGhost: true,
                linkedSource: 'call',
                linkedTaskId: callId,
                expiresAt: expiresAt,
                version: 'v2',
            });

            return await databases.createDocument(
                APPWRITE_CONFIG.DATABASES.NOTE,
                APPWRITE_CONFIG.TABLES.NOTE.NOTES,
                ID.unique(),
                {
                    title: title || 'Call Chat',
                    content: '',
                    format: 'markdown',
                    isPublic: true,
                    userId: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    metadata
                },
                [
                    Permission.read(Role.any()),
                    Permission.update(Role.any()),
                ]
            );
        } catch (e) {
            console.error('[CallService] createGhostNoteForCall failed:', e);
            throw e;
        }
    },

    async updateCallMetadata(callId: string, extraMetadata: Record<string, any>) {
        try {
            const call = await this.getCallLink(callId);
            if (!call) throw new Error('Call not found');

            const { updateCallMetadataSecureAction } = await import('@/lib/actions/secure-ops');
            const result = await updateCallMetadataSecureAction(callId, extraMetadata);

            activeCallsCache.invalidate();
            return result;
        } catch (e) {
            console.error('[CallService] updateCallMetadata failed:', e);
            throw e;
        }
    },

    async deleteCall(callId: string) {
        try {
            const { endCallSecureAction } = await import('@/lib/actions/secure-ops');
            await endCallSecureAction(callId);
            historyCache.invalidate();
            activeCallsCache.invalidate();
        } catch (_e) {
            return;
        }
    },

    async addCohost(callId: string, cohostId: string, allowEndCall: boolean = false) {
        const { addCallCohostSecureAction } = await import('@/lib/actions/secure-ops');
        const result = await addCallCohostSecureAction(callId, cohostId, allowEndCall);
        activeCallsCache.invalidate();
        return result;
    }
};
