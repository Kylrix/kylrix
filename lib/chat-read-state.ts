'use client';

const getStorageKey = (userId: string, conversationId: string) => `kylrix_connect_chat_read_${userId}_${conversationId}`;

export const getConversationReadAt = (userId: string | undefined | null, conversationId: string) => {
    if (!userId || typeof window === 'undefined') return 0;

    const raw = localStorage.getItem(getStorageKey(userId, conversationId));
    if (!raw) return 0;

    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

export const markConversationRead = (userId: string | undefined | null, conversationId: string, readAt = new Date()) => {
    if (!userId || typeof window === 'undefined') return 0;

    const value = readAt.toISOString();
    localStorage.setItem(getStorageKey(userId, conversationId), value);
    return readAt.getTime();
};
