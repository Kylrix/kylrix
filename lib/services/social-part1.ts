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
            Query.limit(uniqueIds.length)]);
        return result.rows || [];
    } catch (_e) {
        return await Promise.all(uniqueIds.map((id: any) => tablesDB.getRow(databaseId, tableId, id).catch(() => null)))
            .then((rows) => rows.filter(Boolean));
    }
};

const interactionCountsCache = new Map<string, { stats: { likes: number; replies: number; pulses: number }; at: number }>();
const interactionCountsInflight = new Map<string, Promise<{ likes: number; replies: number; pulses: number }>>();
const COUNTS_TTL_MS = 60 * 1000;

