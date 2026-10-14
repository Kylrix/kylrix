'use client';

export type UserPresenceState = 'online' | 'away' | 'busy' | 'offline';

export interface PresencePayload {
    userId: string;
    state: UserPresenceState;
    activity?: string;
    lastSeen?: string;
    metadata?: Record<string, any>;
}

export const PresenceService = {
    broadcastState: async (_channel: string, _data: Partial<PresencePayload>) => {
        return null;
    },

    subscribeToPresence: (_channel: string, _callback: (payload: any) => void) => {
        return () => {};
    },

    getResourceChannel: (databaseId: string, tableId: string, rowId: string) => {
        return `databases.${databaseId}.tables.${tableId}.rows.${rowId}`;
    },

    getChatChannel: (conversationId: string) => {
        return `chat.conversations.${conversationId}`;
    },

    getCallChannel: (callId: string) => {
        return `call.${callId}`;
    },
};
