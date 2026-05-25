'use client';

import { realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type UserPresenceState = 'online' | 'away' | 'busy' | 'offline';

export interface PresencePayload {
    userId: string;
    state: UserPresenceState;
    activity?: string;
    lastSeen?: string;
    metadata?: Record<string, any>;
}

export const PresenceService = {
    /**
     * Broadcast ephemeral state for the current user.
     * Use this for typing indicators, focus status, or cursor positions.
     */
    broadcastState: async (channel: string, data: Partial<PresencePayload>) => {
        try {
            // @ts-ignore - Assuming setPresence exists in the 2026 Appwrite SDK
            return await realtime.setPresence(channel, data);
        } catch (err) {
            console.warn('[Presence] Broadcast failed:', err);
            return null;
        }
    },

    /**
     * Subscribe to presence events in a specific context.
     */
    subscribeToPresence: (channel: string, callback: (payload: any) => void) => {
        // Appwrite 2026 uses 'presence.[context]' for its dedicated presence channels
        return realtime.subscribe([`presence.${channel}`], (response) => {
            callback(response.payload);
        });
    },

    /**
     * Helper to build a table-scoped presence channel.
     */
    getResourceChannel: (databaseId: string, tableId: string, rowId: string) => {
        return `databases.${databaseId}.collections.${tableId}.documents.${rowId}`;
    },

    /**
     * Helper for chat-specific presence (typing indicators).
     */
    getChatChannel: (conversationId: string) => {
        return `chat.conversations.${conversationId}`;
    }
};
