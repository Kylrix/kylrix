import type { Models } from 'appwrite';

export type ChatMessage = Models.Row & Record<string, any>;
export type ChatReaction = Models.Row & {
    conversationId: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt?: string;
    updatedAt?: string;
    $updatedAt?: string;
};
export type SenderProfile = {
    displayName?: string | null;
    username?: string | null;
    avatar?: string | null;
    avatarUrl?: string | null;
    preferences?: any | null;
};

export const MessagesType = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    FILE: 'file',
    CALL_SIGNAL: 'call_signal',
    SYSTEM: 'system'} as const;
