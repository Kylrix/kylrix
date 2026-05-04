import { ID, Query } from 'appwrite';
import { tablesDB, realtime, storage } from '../appwrite/client';
import { UsersService } from './users';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getCachedMomentPreview, seedMomentPreview } from '../moment-preview';
import { getCachedMomentThread } from '../moment-thread-cache';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const MOMENTS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
const FOLLOWS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.FOLLOWS;
const INTERACTIONS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.INTERACTIONS;
const MOMENT_LIST_SELECT = ['$id', 'userId', 'caption', 'fileId', 'momentKind', 'sourceId', 'searchTitle', 'createdAt', 'expiresAt'];
const INTERACTION_LIST_SELECT = ['$id', 'userId', 'messageId', 'emoji', 'createdAt'];

export interface MomentMetadata {
    type: 'post' | 'reply' | 'pulse' | 'quote';
    sourceId?: string; // For replies, pulses, and quotes
    attachments?: {
        type: 'note' | 'event' | 'image' | 'video' | 'call';
        id: string;
    }[];
}

const parseMomentMetadata = (moment: any): MomentMetadata | null => {
    try {
        if (moment?.fileId && (moment.fileId.startsWith('{') || moment.fileId.startsWith('['))) {
            return JSON.parse(moment.fileId);
        }
    } catch (_e) {
        // Legacy moments can keep using the raw fileId path.
    }
    return null;
};

const getMomentKind = (moment: any): MomentMetadata['type'] | null => {
    const explicit = String(moment?.momentKind || '').trim().toLowerCase();
    if (explicit === 'post' || explicit === 'reply' || explicit === 'pulse' || explicit === 'quote') {
        return explicit;
    }
    return parseMomentMetadata(moment)?.type || null;
};

const getMomentSourceId = (moment: any): string | null => {
    const explicit = String(moment?.sourceId || '').trim();
    if (explicit) return explicit;
    return parseMomentMetadata(moment)?.sourceId || null;
};

const fetchRowsByIds = async (databaseId: string, tableId: string, ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return [];

    try {
        const result = await tablesDB.listRows(databaseId, tableId, [
            Query.equal('$id', uniqueIds),
            Query.limit(uniqueIds.length),
        ]);
        return result.rows || [];
    } catch (_e) {
        return await Promise.all(uniqueIds.map((id) => tablesDB.getRow(databaseId, tableId, id).catch(() => null)))
            .then((rows) => rows.filter(Boolean));
    }
};

export const SocialService = {
    async getInteractionCounts(momentId: string) {
        try {
            const interactions = await tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
                Query.equal('messageId', momentId),
                Query.select(INTERACTION_LIST_SELECT),
                Query.limit(100)
            ]);

            const likes = interactions.rows.filter((i: any) => i.emoji === 'like').length;

            const related = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                Query.equal('sourceId', momentId),
                Query.select(MOMENT_LIST_SELECT),
                Query.limit(200)
            ]).catch(() => ({ rows: [] as any[] }));

            let replies = 0;
            let pulses = 0;

            for (const m of related.rows || []) {
                const kind = getMomentKind(m);
                if (kind === 'reply') replies += 1;
                if (kind === 'pulse') pulses += 1;
            }

            if (!related.rows?.length) {
                const legacy = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                    Query.select(MOMENT_LIST_SELECT),
                    Query.orderDesc('$createdAt'),
                    Query.limit(100)
                ]).catch(() => ({ rows: [] as any[] }));

                for (const m of legacy.rows || []) {
                    const kind = getMomentKind(m);
                    const sourceId = getMomentSourceId(m);
                    if (sourceId !== momentId) continue;
                    if (kind === 'reply') replies += 1;
                    if (kind === 'pulse') pulses += 1;
                }
            }

            return { likes, replies, pulses };
        } catch (_e) {
            return { likes: 0, replies: 0, pulses: 0 };
        }
    },

    // Lightweight helpers to list interactions or pulses without bloat
    async _listInteractionsFor(momentId: string, emoji: string) {
        try {
            const rows = await tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
                Query.equal('messageId', momentId),
                Query.equal('emoji', emoji),
                Query.select(INTERACTION_LIST_SELECT),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            // return minimal footprint
            return rows.rows.map((r: any) => ({ userId: r.userId, createdAt: r.createdAt || r.$createdAt }));
        } catch (e) {
            console.error('_listInteractionsFor error', e);
            return [];
        }
    },

    async _listPulsesFor(sourceId: string) {
        try {
            const moments = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                Query.equal('sourceId', sourceId),
                Query.equal('momentKind', 'pulse'),
                Query.select(MOMENT_LIST_SELECT),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);

            if (moments.rows.length) {
                return moments.rows.map((m: any) => ({ userId: m.userId || m.creatorId, createdAt: m.$createdAt || m.createdAt }));
            }

            const legacy = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                Query.select(MOMENT_LIST_SELECT),
                Query.orderDesc('$createdAt'),
                Query.limit(200)
            ]);

            return legacy.rows.filter((m: any) => {
                const kind = getMomentKind(m);
                const legacySourceId = getMomentSourceId(m);
                return kind === 'pulse' && legacySourceId === sourceId;
            }).map((m: any) => ({ userId: m.userId || m.creatorId, createdAt: m.$createdAt || m.createdAt }));
        } catch (e) {
            console.error('_listPulsesFor error', e);
            return [];
        }
    },

    async isPulsed(userId: string, sourceId: string) {
        try {
            const pulses = await this._listPulsesFor(sourceId);
            return pulses.some((p: any) => p.userId === userId);
        } catch (e) {
            console.error('isPulsed error', e);
            return false;
        }
    },

    async toggleLike(userId: string, momentId: string, creatorId?: string, contentSnippet?: string) {
    try {
        const existing = await tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
            Query.equal('userId', userId),
            Query.equal('messageId', momentId),
            Query.equal('emoji', 'like'),
            Query.select(['$id'])
        ]);

        if (existing.total > 0) {
            await tablesDB.deleteRow(DB_ID, INTERACTIONS_TABLE, existing.rows[0].$id);
            return { liked: false };
        } else {
            await tablesDB.createRow(DB_ID, INTERACTIONS_TABLE, ID.unique(), {
                userId,
                messageId: momentId,
                emoji: 'like',
                createdAt: new Date().toISOString()
            });

            // Record in Activity Log for Notifications (if not our own post)
            if (creatorId && creatorId !== userId) {
                try {
                    await tablesDB.createRow(
                        APPWRITE_CONFIG.DATABASES.KYLRIXNOTE, 
                        APPWRITE_CONFIG.TABLES.KYLRIXNOTE.ACTIVITY_LOG, 
                        ID.unique(), 
                        {
                            userId: creatorId,
                            action: 'Moment Liked',
                            targetType: 'moment',
                            targetId: momentId,
                            details: JSON.stringify({
                                read: false,
                                originalDetails: `Someone liked your post: ${contentSnippet || '...'}` ,
                                actionUrl: `https://connect.${process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space'}/post/${momentId}`
                            })
                        }
                    );
                } catch (_logErr) {
                    console.warn('Failed to log like to activityLog');
                }
            }

            return { liked: true };
        }
    } catch (error) {
        console.error('toggleLike error:', error);
        throw error;
    }
},

    async isLiked(userId: string, momentId: string) {
        const existing = await tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
            Query.equal('userId', userId),
            Query.equal('messageId', momentId),
            Query.equal('emoji', 'like'),
            Query.select(['$id'])
        ]);
        return existing.total > 0;
    },

    async enrichMoment(moment: any, currentUserId?: string) {
        const parsedMetadata = parseMomentMetadata(moment);
        const resolvedKind = getMomentKind(moment);
        const resolvedSourceId = getMomentSourceId(moment);
        const metadata: MomentMetadata | null = (resolvedKind || resolvedSourceId || parsedMetadata)
            ? {
                type: resolvedKind || parsedMetadata?.type || 'post',
                sourceId: resolvedSourceId || parsedMetadata?.sourceId || undefined,
                attachments: parsedMetadata?.attachments || [],
            }
            : null;

        const enriched = { 
            ...moment, 
            metadata, 
            stats: { likes: 0, replies: 0, pulses: 0 },
            isLiked: false
        };

        // Fetch counts
        const counts = await this.getInteractionCounts(moment.$id);
        enriched.stats = counts;

        if (currentUserId) {
            enriched.isLiked = await this.isLiked(currentUserId, moment.$id);
            try {
                enriched.isPulsed = await this.isPulsed(currentUserId, moment.$id);
            } catch (_e) {
                enriched.isPulsed = false;
            }
        }

        // Handle Legacy & New Metadata Attachments
        const attachments = metadata?.attachments || [];
        
        // If legacy, synthesize an attachment for the enrichment loop
        if (!metadata && moment.fileId && moment.fileId !== 'none') {
            if (moment.fileId.startsWith('note:')) {
                attachments.push({ type: 'note', id: moment.fileId.replace('note:', '') });
            } else if (moment.fileId.startsWith('event:')) {
                attachments.push({ type: 'event', id: moment.fileId.replace('event:', '') });
            }
        }

        // Resolve attachments
        await Promise.all(attachments.map(async (att) => {
            try {
                if (att.type === 'note') {
                    const note = await tablesDB.getRow(
                        APPWRITE_CONFIG.DATABASES.KYLRIXNOTE,
                        APPWRITE_CONFIG.TABLES.KYLRIXNOTE.USERS === '67ff05c900247b5673d3' ? '67ff05f3002502ef239e' : 'notes',
                        att.id
                    );
                    enriched.attachedNote = note;
                } else if (att.type === 'event') {
                    const event = await tablesDB.getRow(
                        APPWRITE_CONFIG.DATABASES.KYLRIXFLOW,
                        'events',
                        att.id
                    );
                    enriched.attachedEvent = event;
                } else if (att.type === 'call') {
                    const call = await tablesDB.getRow(
                        APPWRITE_CONFIG.DATABASES.CHAT,
                        APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
                        att.id
                    );
                    enriched.attachedCall = call;
                } else if (att.type === 'image' || att.type === 'video') {
                    // For now, we just keep the IDs in enriched.attachments
                    if (!enriched.attachments) enriched.attachments = [];
                    enriched.attachments.push(att);
                }
            } catch (_e) {
                console.warn(`Failed to resolve attachment ${att.type}:${att.id}`, _e);
            }
        }));

        // Resolve Source Moment (for Pulse/Quote/Reply)
        if (metadata?.sourceId) {
            try {
                const source = await this.getMomentById(metadata.sourceId);
                enriched.sourceMoment = source;
            } catch (_e) {
                console.warn(`Failed to resolve source moment ${metadata.sourceId}`, _e);
            }
        }

        return enriched;
    },

    async getFeed(userId?: string, targetUserId?: string) {
        // Fetch public moments or moments from followed users
        const queries = [
            Query.select(MOMENT_LIST_SELECT),
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ];

        if (targetUserId) {
            queries.push(Query.equal('userId', targetUserId));
        }

        const moments = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, queries);
        const rawRows = moments.rows || [];
        const momentIds = rawRows.map((moment: any) => moment.$id);

        const [interactionRows, recentMomentRows, userPulseRows] = await Promise.all([
            momentIds.length
                ? tablesDB.listRows(DB_ID, INTERACTIONS_TABLE, [
                    Query.equal('messageId', momentIds),
                    Query.select(INTERACTION_LIST_SELECT),
                    Query.limit(1000)
                ]).then((res) => res.rows || []).catch(() => [])
                : Promise.resolve([]),
            momentIds.length
                ? tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                    Query.equal('sourceId', momentIds),
                    Query.select(MOMENT_LIST_SELECT),
                    Query.limit(1000)
                ]).then((res) => res.rows || []).catch(() => [])
                : Promise.resolve([]),
            userId
                ? tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                    Query.equal('userId', userId),
                    Query.equal('momentKind', 'pulse'),
                    Query.select(MOMENT_LIST_SELECT),
                    Query.orderDesc('$createdAt'),
                    Query.limit(200)
                ]).then((res) => res.rows || []).catch(() => [])
                : Promise.resolve([]),
        ]);

        const likesByMoment = new Map<string, number>();
        const likedMomentIds = new Set<string>();
        interactionRows.forEach((row: any) => {
            if (!row?.messageId) return;
            if (row.emoji === 'like') {
                likesByMoment.set(row.messageId, (likesByMoment.get(row.messageId) || 0) + 1);
                if (userId && row.userId === userId) likedMomentIds.add(row.messageId);
            }
        });

        const engagementBySource = new Map<string, { replies: number; pulses: number }>();
        recentMomentRows.forEach((moment: any) => {
            const sourceId = getMomentSourceId(moment);
            const kind = getMomentKind(moment);
            if (!sourceId) return;
            const counts = engagementBySource.get(sourceId) || { replies: 0, pulses: 0 };
            if (kind === 'reply') counts.replies += 1;
            if (kind === 'pulse') counts.pulses += 1;
            engagementBySource.set(sourceId, counts);
        });

        const pulsedMomentIds = new Set<string>();
        userPulseRows.forEach((moment: any) => {
            const sourceId = getMomentSourceId(moment);
            const kind = getMomentKind(moment);
            if (kind === 'pulse' && sourceId) {
                pulsedMomentIds.add(sourceId);
            }
        });

        const baseRows = rawRows.map((moment: any) => {
            const parsedMetadata = parseMomentMetadata(moment);
            const metadata = {
                type: getMomentKind(moment) || parsedMetadata?.type || 'post',
                sourceId: getMomentSourceId(moment) || parsedMetadata?.sourceId || undefined,
                attachments: parsedMetadata?.attachments || [],
            };
            const counts = engagementBySource.get(moment.$id) || { replies: 0, pulses: 0 };
            const likes = likesByMoment.get(moment.$id) || 0;

            return {
                ...moment,
                metadata,
                stats: {
                    likes,
                    replies: counts.replies,
                    pulses: counts.pulses,
                },
                isLiked: Boolean(userId && likedMomentIds.has(moment.$id)),
                isPulsed: Boolean(userId && pulsedMomentIds.has(moment.$id)),
            };
        });

        const rankedRows = baseRows.map((m: any) => {
            let baseWeight = 1.0;
            const type = m.metadata?.type || 'post';

            if (type === 'pulse') baseWeight = 0.75;
            if (type === 'reply') baseWeight = 0.5;

            const engagementScore = (m.stats?.likes || 0) * 0.2 + (m.stats?.replies || 0) * 0.4;
            const finalScore = baseWeight + engagementScore;

            return { ...m, _rankScore: finalScore };
        });

        // Filter: Only show replies if they have significant engagement (score > 1.0)
        // This ensures "high value" comments show up tied to their threads in the feed
        const filteredRows = rankedRows.filter((m: any) => {
            // If we are looking at a specific user's feed, show their replies too
            if (targetUserId && m.userId === targetUserId) return true;

            if (m.metadata?.type === 'reply') {
                return m._rankScore > 1.0; 
            }
            return true;
        });

        // Sort by final score then by date
        const sortedRows = filteredRows.sort((a, b) => {
            if (Math.abs(b._rankScore - a._rankScore) > 0.1) {
                return b._rankScore - a._rankScore;
            }
            return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
        });

        const topRows = sortedRows.slice(0, 50);
        const sourceIds = Array.from(new Set(topRows.map((moment: any) => moment.metadata?.sourceId).filter(Boolean)));
        const attachmentGroups = {
            note: new Set<string>(),
            event: new Set<string>(),
            call: new Set<string>(),
        };

        topRows.forEach((moment: any) => {
            const attachments = moment.metadata?.attachments || [];
            attachments.forEach((attachment: any) => {
                if (!attachment?.id) return;
                if (attachment.type === 'note') attachmentGroups.note.add(attachment.id);
                if (attachment.type === 'event') attachmentGroups.event.add(attachment.id);
                if (attachment.type === 'call') attachmentGroups.call.add(attachment.id);
            });
        });

        const [sourceMoments, noteRows, eventRows, callRows] = await Promise.all([
            fetchRowsByIds(DB_ID, MOMENTS_TABLE, sourceIds),
            fetchRowsByIds(APPWRITE_CONFIG.DATABASES.KYLRIXNOTE, APPWRITE_CONFIG.TABLES.KYLRIXNOTE.USERS === '67ff05c900247b5673d3' ? '67ff05f3002502ef239e' : 'notes', Array.from(attachmentGroups.note)),
            fetchRowsByIds(APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, 'events', Array.from(attachmentGroups.event)),
            fetchRowsByIds(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS, Array.from(attachmentGroups.call)),
        ]);

        const sourceMomentMap = new Map<string, any>(sourceMoments.map((row: any) => [row.$id, row]));
        const noteMap = new Map<string, any>(noteRows.map((row: any) => [row.$id, row]));
        const eventMap = new Map<string, any>(eventRows.map((row: any) => [row.$id, row]));
        const callMap = new Map<string, any>(callRows.map((row: any) => [row.$id, row]));

        const hydratedRows = topRows.map((moment: any) => {
            const attachments = moment.metadata?.attachments || [];
            const attachedNote = attachments.find((attachment: any) => attachment.type === 'note' && noteMap.has(attachment.id));
            const attachedEvent = attachments.find((attachment: any) => attachment.type === 'event' && eventMap.has(attachment.id));
            const attachedCall = attachments.find((attachment: any) => attachment.type === 'call' && callMap.has(attachment.id));

            return {
                ...moment,
                sourceMoment: moment.metadata?.sourceId ? sourceMomentMap.get(moment.metadata.sourceId) || null : null,
                attachedNote: attachedNote ? noteMap.get(attachedNote.id) : undefined,
                attachedEvent: attachedEvent ? eventMap.get(attachedEvent.id) : undefined,
                attachedCall: attachedCall ? callMap.get(attachedCall.id) : undefined,
            };
        });

        return { ...moments, rows: hydratedRows, total: sortedRows.length };
    },

    async getTrendingFeed(userId?: string) {
        const feed = await this.getFeed(userId);
        // Simply sort by rank score exclusively for trending
        const trendingRows = [...feed.rows].sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0));
        return { ...feed, rows: trendingRows };
    },

    subscribeToFeed(callback: (event: { type: 'create' | 'update' | 'delete', payload: any }) => void) {
        const momentsChannel = `databases.${DB_ID}.collections.${MOMENTS_TABLE}.documents`;
        const interactionsChannel = `databases.${DB_ID}.collections.${INTERACTIONS_TABLE}.documents`;

        const unsubMomentsPromise = realtime.subscribe(momentsChannel, (response) => {
            const payload = response.payload;
            let type: 'create' | 'update' | 'delete' | null = null;

            if (response.events.some(e => e.includes('.create'))) type = 'create';
            else if (response.events.some(e => e.includes('.update'))) type = 'update';
            else if (response.events.some(e => e.includes('.delete'))) type = 'delete';

            if (type) {
                callback({ type, payload });
            }
        });

        const unsubInteractionsPromise = realtime.subscribe(interactionsChannel, (response) => {
            if (response.events.some(e => e.includes('.create') || e.includes('.delete'))) {
                const payload = response.payload;
                callback({ type: 'update', payload: { $id: payload.messageId, _interactionUpdate: true } });
            }
        });

        return async () => {
            const unsubMoments = await unsubMomentsPromise as any;
            const unsubInteractions = await unsubInteractionsPromise as any;

            if (typeof unsubMoments === 'function') unsubMoments();
            else if (unsubMoments?.unsubscribe) unsubMoments.unsubscribe();
            
            if (typeof unsubInteractions === 'function') unsubInteractions();
            else if (unsubInteractions?.unsubscribe) unsubInteractions.unsubscribe();
        };
    },

    async uploadMedia(file: File) {
        try {
            const uploaded = await storage.createFile(
                APPWRITE_CONFIG.BUCKETS.MESSAGES, // Using messages bucket as it exists and is likely generic
                ID.unique(),
                file
            );
            return uploaded.$id;
        } catch (_e) {
            console.error('Failed to upload media', _e);
            throw _e;
        }
    },

    getMediaPreview(fileId: string, width: number = 800, height: number = 600) {
        return storage.getFilePreview(APPWRITE_CONFIG.BUCKETS.MESSAGES, fileId, width, height).toString();
    },

    async createMoment(creatorId: string, content: string, type: 'post' | 'reply' | 'pulse' | 'quote' = 'post', mediaIds: string[] = [], _visibility: 'public' | 'private' | 'followers' = 'public', noteId?: string, eventId?: string, sourceId?: string, callId?: string) {
        const permissions = [
            `read("user:${creatorId}")`,
            `update("user:${creatorId}")`,
            `delete("user:${creatorId}")`,
        ];

        // Build Metadata-based fileId
        const metadata: MomentMetadata = { type };
        if (sourceId) metadata.sourceId = sourceId;
        
        metadata.attachments = mediaIds.map(id => ({ type: 'image', id }));
        if (noteId) metadata.attachments.push({ type: 'note', id: noteId });
        if (eventId) metadata.attachments.push({ type: 'event', id: eventId });
        if (callId) metadata.attachments.push({ type: 'call', id: callId });

        const effectiveFileId = JSON.stringify(metadata);

        // Prevent duplicate pulses: if this is a pulse and the user already has a pulse
        // for the same sourceId, return the existing moment instead of creating another.
        if (type === 'pulse' && sourceId) {
            try {
                const recent = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
                    Query.equal('userId', creatorId),
                    Query.equal('momentKind', 'pulse'),
                    Query.equal('sourceId', sourceId),
                    Query.orderDesc('$createdAt'),
                    Query.limit(1)
                ]);

                if (recent.rows[0]) {
                    // Already pulsed by this user; return the existing row to dedupe at the service layer.
                    return recent.rows[0];
                }
            } catch (dedupeErr) {
                console.warn('pulse dedupe check failed', dedupeErr);
                // Fall through and attempt to create the moment if the check fails
            }
        }

        const moment = await tablesDB.createRow(DB_ID, MOMENTS_TABLE, ID.unique(), {
            userId: creatorId, 
            caption: content,
            type: 'image', // Database schema only accepts image/video
            momentKind: type,
            sourceId: sourceId || null,
            searchTitle: content || null,
            fileId: effectiveFileId, 
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
        }, permissions);

        // Record in Activity Log for Ecosystem Notifications
        try {
            let targetUserId = creatorId;
            if (type === 'reply' || type === 'pulse' || type === 'quote') {
                try {
                    const sourceMoment = await tablesDB.getRow(DB_ID, MOMENTS_TABLE, sourceId!);
                    targetUserId = sourceMoment.userId;
                } catch (sourceErr) {
                    console.warn('Failed to fetch source moment for activity log', sourceErr);
                }
            }

            await tablesDB.createRow(
                APPWRITE_CONFIG.DATABASES.KYLRIXNOTE, 
                APPWRITE_CONFIG.TABLES.KYLRIXNOTE.ACTIVITY_LOG, 
                ID.unique(), 
                {
                    userId: targetUserId,
                    action: type === 'post' ? 'Post Created' : type === 'reply' ? 'Moment Replied' : type === 'pulse' ? 'Moment Pulsed' : 'Moment Quoted',
                    targetType: 'moment',
                    targetId: moment.$id,
                    details: JSON.stringify({
                        read: targetUserId === creatorId, // Auto-read if it's our own action
                        originalDetails: type === 'post' ? `New post shared: ${content.substring(0, 50)}...` : 
                            type === 'reply' ? `Someone replied to your post: ${content.substring(0, 50)}...` :
                            type === 'pulse' ? `Someone pulsed your post` : `Someone quoted your post`,
                        actionUrl: `https://connect.${process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space'}/post/${moment.$id}`
                    })
                }
            );
        } catch (_logErr) {
            console.warn('Failed to log moment action to activityLog');
        }

        return moment;
    },

    async deleteMoment(momentId: string) {
        return await tablesDB.deleteRow(DB_ID, MOMENTS_TABLE, momentId);
    },

    async unpulseMoment(userId: string, sourceId: string) {
        const existing = await tablesDB.listRows(DB_ID, MOMENTS_TABLE, [
            Query.equal('userId', userId),
            Query.equal('momentKind', 'pulse'),
            Query.equal('sourceId', sourceId),
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ]);

        const pulseToDelete = existing.rows[0] || null;

        if (pulseToDelete) {
            await this.deleteMoment(pulseToDelete.$id);
            return true;
        }
        return false;
    },

    async updateMomentVisibility(momentId: string, _visibility: 'public' | 'private' | 'followers') {
        return await tablesDB.updateRow(DB_ID, MOMENTS_TABLE, momentId, { visibility: _visibility });
    },

    async updateMoment(momentId: string, content: string) {
        return await tablesDB.updateRow(DB_ID, MOMENTS_TABLE, momentId, {
            caption: content,
            searchTitle: content,
            updatedAt: new Date().toISOString()
        });
    },

    async likeMoment(userId: string, momentId: string) {
        return await tablesDB.createRow(DB_ID, INTERACTIONS_TABLE, ID.unique(), {
            userId,
            momentId,
            type: 'like'
        });
    },

    async followUser(followerId: string, followingId: string) {
        // Prevent duplicate follow rows: check if a follow already exists using robust check
        try {
            const followerIds = await this._resolveUserIds(followerId);
            const followingIds = await this._resolveUserIds(followingId);

            const existing = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followerId', followerIds),
                Query.equal('followingId', followingIds),
                Query.limit(1)
            ]);

            if (existing.total > 0) {
                // Already following
                return existing.rows[0];
            }

            return await tablesDB.createRow(DB_ID, FOLLOWS_TABLE, ID.unique(), {
                followerId, // Store using the passed IDs, but we checked all variants for existence
                followingId,
                status: 'accepted',
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            console.error('[SocialService] followUser error', err);
            throw err;
        }
    },

    async unfollowUser(followerId: string, followingId: string) {
        try {
            const followerIds = await this._resolveUserIds(followerId);
            const followingIds = await this._resolveUserIds(followingId);

            const existing = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followerId', followerIds),
                Query.equal('followingId', followingIds),
                Query.limit(100)
            ]);

            if (existing.total > 0) {
                // Remove all matching follow relationships to avoid stale duplicates
                for (const row of existing.rows) {
                    try { await tablesDB.deleteRow(DB_ID, FOLLOWS_TABLE, row.$id); } catch (_e) {}
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('[SocialService] unfollowUser error', err);
            throw err;
        }
    },

    async _resolveUserIds(id: string): Promise<string[]> {
        const ids = [id];
        try {
            const profile = await UsersService.getProfileById(id);
            if (profile) {
                if (profile.userId && !ids.includes(profile.userId)) ids.push(profile.userId);
                if (profile.$id && !ids.includes(profile.$id)) ids.push(profile.$id);
            }
        } catch (_e) {
            // ignore resolution errors, stick with provided ID
        }
        return ids;
    },

    async isFollowing(followerId: string, followingId: string) {
        try {
            const followerIds = await this._resolveUserIds(followerId);
            const followingIds = await this._resolveUserIds(followingId);

            const existing = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followerId', followerIds),
                Query.equal('followingId', followingIds),
                Query.equal('status', 'accepted'),
                Query.limit(1)
            ]);
            
            return existing.total > 0;
        } catch (e) {
            console.error('[SocialService] isFollowing error', e);
            return false;
        }
    },

    async getFollowStats(userId: string) {
        try {
            const ids = await this._resolveUserIds(userId);

            // Count all follower relations where followingId matches any of the user's IDs and status is accepted
            const followers = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followingId', ids),
                Query.equal('status', 'accepted'),
                Query.limit(1) // We only need the total
            ]);
            
            // Count all following relations where followerId matches any of the user's IDs and status is accepted
            const following = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followerId', ids),
                Query.equal('status', 'accepted'),
                Query.limit(1) // We only need the total
            ]);

            return {
                followers: followers.total,
                following: following.total,
                followerRows: followers.rows,
                followingRows: following.rows
            };
        } catch (_e) {
            console.error('[SocialService] getFollowStats error', _e);
            return { followers: 0, following: 0, followerRows: [], followingRows: [] };
        }
    },

    async getFollowers(userId: string, currentUserId?: string) {
        try {
            const ids = await this._resolveUserIds(userId);
            const result = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followingId', ids),
                Query.equal('status', 'accepted'),
                Query.limit(100)
            ]);

            const profiles = await Promise.all(
                result.rows.map(async (row: any) => {
                    const profile = await UsersService.getProfileById(row.followerId);
                    if (!profile) return null;
                    
                    let isFollowing = false;
                    if (currentUserId) {
                        isFollowing = await this.isFollowing(currentUserId, profile.userId || profile.$id);
                    }
                    
                    return { ...profile, followRowId: row.$id, isFollowing };
                })
            );

            return profiles.filter(p => p !== null);
        } catch (error) {
            console.error('[SocialService] getFollowers error', error);
            return [];
        }
    },

    async getFollowing(userId: string, currentUserId?: string) {
        try {
            const ids = await this._resolveUserIds(userId);
            const result = await tablesDB.listRows(DB_ID, FOLLOWS_TABLE, [
                Query.equal('followerId', ids),
                Query.equal('status', 'accepted'),
                Query.limit(100)
            ]);

            const profiles = await Promise.all(
                result.rows.map(async (row: any) => {
                    const profile = await UsersService.getProfileById(row.followingId);
                    if (!profile) return null;

                    let isFollowing = false;
                    if (currentUserId) {
                        // For a "following" list of the current user, this is always true.
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
