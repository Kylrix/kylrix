import { Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

export const EcosystemService = {
    async listNotes(userId: string) {
        return await tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.KYLRIXNOTE,
            '67ff05f3002502ef239e',
            [
                Query.equal('userId', userId),
                Query.orderDesc('$updatedAt'),
                Query.limit(50)
            ]
        );
    },

    async createNote(userId: string, title: string, content: string) {
        return await tablesDB.createRow(
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
    },

    async listSecrets(userId: string) {
        return await tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'credentials',
            [
                Query.equal('userId', userId),
                Query.orderDesc('$updatedAt'),
                Query.limit(50)
            ]
        );
    },

    async listTotpSecrets(userId: string) {
        return await tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'totpSecrets',
            [
                Query.equal('userId', userId),
                Query.orderDesc('$updatedAt'),
                Query.limit(50)
            ]
        );
    },

    async listEvents(userId: string) {
        return await tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.KYLRIXFLOW,
            'events',
            [
                Query.equal('userId', userId),
                Query.orderDesc('startTime'),
                Query.limit(50)
            ]
        );
    }
};
