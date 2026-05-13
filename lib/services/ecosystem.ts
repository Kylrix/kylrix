import { Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getNamedListCache } from './list-cache';

const notesCache = getNamedListCache<any>('eco_notes', 45000);
const secretsCache = getNamedListCache<any>('eco_secrets', 45000);
const totpCache = getNamedListCache<any>('eco_totp', 45000);
const eventsCache = getNamedListCache<any>('eco_events', 45000);

export const EcosystemService = {
    async listNotes(userId: string, force = false) {
        return notesCache.fetch(async () => {
            return await tablesDB.listRows(
                APPWRITE_CONFIG.DATABASES.KYLRIXNOTE,
                '67ff05f3002502ef239e',
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$updatedAt'),
                    Query.limit(50)
                ]
            );
        }, force);
    },

    async createNote(userId: string, title: string, content: string) {
        const res = await tablesDB.createRow(
            APPWRITE_CONFIG.DATABASES.KYLRIXNOTE,
            '67ff05f3002502ef239e',
            'unique()',
            {
                userId,
                title,
                content,
                isPublic: false,
                status: 'published',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        );
        notesCache.invalidate();
        return res;
    },

    async listSecrets(userId: string, force = false) {
        return secretsCache.fetch(async () => {
            return await tablesDB.listRows(
                APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
                'credentials',
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$updatedAt'),
                    Query.limit(50)
                ]
            );
        }, force);
    },

    async listTotpSecrets(userId: string, force = false) {
        return totpCache.fetch(async () => {
            return await tablesDB.listRows(
                APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
                'totpSecrets',
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$updatedAt'),
                    Query.limit(50)
                ]
            );
        }, force);
    },

    async listEvents(userId: string, force = false) {
        return eventsCache.fetch(async () => {
            return await tablesDB.listRows(
                APPWRITE_CONFIG.DATABASES.KYLRIXFLOW,
                'events',
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('startTime'),
                    Query.limit(50)
                ]
            );
        }, force);
    }
};
