import { ID, Permission, Role } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const LINKS_TABLE = 'calls'; // Based on connect app config

export const CallService = {
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
                startsAt: startTime.toISOString()
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
    }
};
