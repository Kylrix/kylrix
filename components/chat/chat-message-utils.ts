import { getCachedIdentityById } from '@/lib/identity-cache';
import type { ChatMessage, ChatReaction, SenderProfile } from './chat-types';

export const getMessageTimestamp = (msg: ChatMessage) => new Date(msg.$createdAt || msg.createdAt || Date.now()).getTime();

export const getClientReadSegments = (
    messages: ChatMessage[],
    currentUserId?: string | null,
    isDirectChat = false,
    conversationReadAt = 0
) => {
    if (!currentUserId || !isDirectChat) {
        return {
            outgoingReadAt: 0,
            firstUnreadIncomingIndex: -1};
    }

    let outgoingReadAt = 0;

    for (const msg of messages) {
        if (msg.senderId === currentUserId) continue;
        outgoingReadAt = Math.max(outgoingReadAt, getMessageTimestamp(msg));
    }

    const firstUnreadIncomingIndex = messages.findIndex((msg) =>
        msg.senderId !== currentUserId && getMessageTimestamp(msg) > conversationReadAt
    );

    return {
        outgoingReadAt,
        firstUnreadIncomingIndex};
};

export const groupMessageReactions = (reactions: ChatReaction[], currentUserId?: string | null) => {
    const groups = new Map<string, { emoji: string; count: number; reactedBySelf: boolean }>();

    reactions.forEach((reaction) => {
        const emoji = reaction?.emoji;
        if (!emoji) return;

        const existing = groups.get(emoji);
        if (existing) {
            existing.count += 1;
            existing.reactedBySelf = existing.reactedBySelf || reaction.userId === currentUserId;
            return;
        }

        groups.set(emoji, {
            emoji,
            count: 1,
            reactedBySelf: reaction.userId === currentUserId});
    });

    return Array.from(groups.values());
};

export const dedupeReactionsByUser = (reactions: ChatReaction[]) => {
    const latestByUser = new Map<string, ChatReaction>();

    reactions.forEach((reaction) => {
        if (!reaction?.userId || !reaction?.messageId) return;
        const key = `${reaction.messageId}:${reaction.userId}`;
        const existing = latestByUser.get(key);
        const nextTime = new Date(reaction.updatedAt || reaction.$updatedAt || reaction.createdAt || reaction.$createdAt || 0).getTime();
        const existingTime = existing
            ? new Date(existing.updatedAt || existing.$updatedAt || existing.createdAt || existing.$createdAt || 0).getTime()
            : -1;

        if (!existing || nextTime >= existingTime) {
            latestByUser.set(key, reaction);
        }
    });

    return Array.from(latestByUser.values());
};

export const sortReactionGroups = (reactions: ChatReaction[], currentUserId?: string | null) =>
    groupMessageReactions(reactions, currentUserId).sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.emoji.localeCompare(right.emoji);
    });

export const getReactionActorLabel = (
    userId: string,
    senderProfiles: Record<string, SenderProfile>
) => {
    const cached = senderProfiles[userId] || getCachedIdentityById(userId);
    return cached?.displayName || cached?.username || `@${userId.slice(0, 7)}`;
};
