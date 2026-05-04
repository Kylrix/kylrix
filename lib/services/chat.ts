import { ID, Permission, Query, Role } from 'appwrite';
import { account, storage, tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { KYLRIX_AUTH_URI, getEcosystemUrl } from '../constants';
import { ecosystemSecurity } from '../ecosystem/security';
import { UsersService } from './users';
import { seedIdentityCache } from '@/lib/identity-cache';
import { sendKylrixEmailNotification } from '../email-notifications';


const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const CONV_MEMBERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS || 'conversationMembers';
const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
const EPOCHS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.EPOCHS;
const KEY_MAPPING_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const KEY_MAPPING_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING;
const ACCOUNTS_API_URL = `${KYLRIX_AUTH_URI}/api/permissions`;
const ACCOUNTS_MESSAGE_API_URL = `${KYLRIX_AUTH_URI}/api/connect/messages`;
const ACCOUNTS_MESSAGE_REACTIONS_API_URL = `${KYLRIX_AUTH_URI}/api/connect/message-reactions`;
const ACCOUNTS_JOIN_REQUESTS_API_URL = `${KYLRIX_AUTH_URI}/api/connect/join-requests`;
const ACCOUNTS_KEY_REPAIR_API_URL = `${KYLRIX_AUTH_URI}/api/connect/repair`;
const GROUP_AVATAR_ROUTE = `${KYLRIX_AUTH_URI}/api/connect/group-avatar`;
const conversationKeyCache = new Map<string, CryptoKey>();
const conversationPreviewCache = new Map<string, {
    lastMessageId: string;
    lastMessageText: string;
    lastMessageAt: string;
    lastMessageSenderId?: string | null;
}>();

const arraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const canonicalizeParticipantsForMatch = (participants: string[]) =>
    Array.from(new Set((participants || []).filter(Boolean))).sort();

const uniqueIds = (ids: Array<string | null | undefined>) =>
    Array.from(new Set(ids.map((value) => String(value || '').trim()).filter(Boolean)));

const buildGroupAvatarUrl = (conversationId: string) => `${GROUP_AVATAR_ROUTE}?conversationId=${encodeURIComponent(conversationId)}`;

const setConversationPreviewCache = (
    conversationId: string,
    preview: {
        lastMessageId: string;
        lastMessageText: string;
        lastMessageAt: string;
        lastMessageSenderId?: string | null;
    } | null,
) => {
    if (!conversationId) return;
    if (!preview?.lastMessageId) {
        conversationPreviewCache.delete(conversationId);
        return;
    }

    conversationPreviewCache.set(conversationId, {
        lastMessageId: preview.lastMessageId,
        lastMessageText: preview.lastMessageText || '',
        lastMessageAt: preview.lastMessageAt || new Date().toISOString(),
        lastMessageSenderId: preview.lastMessageSenderId || null,
    });
};

const getConversationPreviewCache = (conversationId: string) => conversationPreviewCache.get(conversationId) || null;

const getConversationMemberSnapshot = async (conversationId: string, fallbackParticipants: string[] = []) => {
    const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
        Query.equal('conversationId', conversationId),
        Query.limit(1000),
    ]).catch(() => ({ rows: [] as any[] }));

    const participants = uniqueIds([
        ...(memberRows.rows || []).map((row: any) => row.userId),
    ]);

    if (participants.length > 0) {
        return participants;
    }

    return uniqueIds(fallbackParticipants);
};

const getConversationActivityAt = (row: any) =>
    row?.lastMessageAt || row?.updatedAt || row?.createdAt || row?.$updatedAt || row?.$createdAt || null;

const getMessageActivityAt = (row: any) =>
    row?.createdAt || row?.updatedAt || row?.$createdAt || row?.$updatedAt || null;

async function notifyMessageStreak(conversation: any, senderId: string, conversationId: string) {
    const recipientIds = Array.isArray(conversation?.participants)
        ? uniqueIds(conversation.participants).filter((id) => id !== senderId)
        : [];

    if (recipientIds.length !== 1) return;

    const recentMessages = await tablesDB.listRows(DB_ID, MSG_TABLE, [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('createdAt'),
        Query.limit(5),
    ]);

    if (recentMessages.rows.length < 5) return;
    if (!recentMessages.rows.every((row: any) => row.senderId === senderId)) return;

    await sendKylrixEmailNotification({
        eventType: 'message_streak',
        sourceApp: 'connect',
        actorName: senderId,
        recipientIds,
        resourceId: conversationId,
        resourceTitle: conversation?.name || conversation?.title || 'Conversation',
        resourceType: 'conversation',
        templateKey: `connect:message-streak:${conversationId}:${senderId}`,
        ctaUrl: `${getEcosystemUrl('connect')}/chat/${conversationId}`,
        ctaText: 'Open chat',
    });
}

const buildConversationMemberPermissions = (_participantIds: string[], creatorId: string) => {
    return [
        Permission.read(Role.user(creatorId)),
        Permission.update(Role.user(creatorId)),
        Permission.delete(Role.user(creatorId)),
    ];
};

const normalizeConversationRow = async (conversation: any) => {
    if (!conversation) return conversation;

    const participants: string[] = Array.isArray(conversation.participants)
        ? conversation.participants.filter((participant: unknown): participant is string => typeof participant === 'string' && participant.length > 0)
        : [];
    const normalizedParticipants = Array.from(new Set(participants));
    const creatorId = conversation.creatorId;

    if (arraysEqual(participants, normalizedParticipants) && creatorId === conversation.creatorId) {
        return conversation;
    }

    return {
        ...conversation,
        participants: normalizedParticipants,
        creatorId
    };
};

const getMessagePreview = async (message: any, conversationId: string) => {
    if (!message) return '';
    if (message.type && message.type !== 'text' && message.type !== 'attachment') {
        return `[${message.type}]`;
    }

    const rawContent = message.content || '';
    if (!rawContent) return '';

    if (!ecosystemSecurity.status.isUnlocked || rawContent.length <= 40) {
        return rawContent;
    }

    try {
        const convKey = ecosystemSecurity.getConversationKey(conversationId);
        if (convKey) {
            return await ecosystemSecurity.decryptWithKey(rawContent, convKey);
        }
        return await ecosystemSecurity.decrypt(rawContent);
    } catch (_e) {
        return '[Encrypted message]';
    }
};

type LockboxEntry = {
    resourceType: string;
    resourceId: string;
    grantee: string;
    wrappedKey: string;
    metadata?: string | Record<string, unknown> | null;
};

const buildLockboxMetadata = (payload: Record<string, unknown>) => JSON.stringify(payload);

type InviteMeta = Record<string, unknown> & {
    name?: string;
    description?: string;
};

const parseInviteMeta = (value: unknown): InviteMeta | null => {
    if (!value) return null;
    if (typeof value === 'object') return value as InviteMeta;
    if (typeof value !== 'string') return null;

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed as InviteMeta : null;
    } catch {
        return null;
    }
};

const buildInviteMeta = (current: any, patch: Record<string, unknown>) => {
    const existing = parseInviteMeta(current?.inviteMeta) || {};
    const next: InviteMeta = {
        ...existing,
    };

    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
        next.name = typeof patch.name === 'string' ? patch.name : '';
    } else if (typeof current?.name === 'string') {
        next.name = current.name;
    } else if (!Object.prototype.hasOwnProperty.call(next, 'name')) {
        next.name = '';
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
        next.description = typeof patch.description === 'string' ? patch.description : '';
    } else if (typeof current?.description === 'string') {
        next.description = current.description;
    } else if (!Object.prototype.hasOwnProperty.call(next, 'description')) {
        next.description = '';
    }

    return JSON.stringify(next);
};

async function getPermissionUpdateAuth(auth?: { jwt?: string; cookie?: string }) {
    let jwt = auth?.jwt || null;
    if (!jwt && !auth?.cookie) {
        const session = await account.createJWT().catch(() => null);
        jwt = session?.jwt || null;
    }

    if (!jwt && !auth?.cookie) {
        throw new Error('Unable to authenticate permission update request');
    }

    return {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        ...(auth?.cookie ? { Cookie: auth.cookie } : {}),
    };
}

async function callPermissionsApi(
    method: 'POST' | 'DELETE',
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const headers = await getPermissionUpdateAuth(auth);
    const response = await fetch(ACCOUNTS_API_URL, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Permission update failed');
    }

    return response.json().catch(() => ({}));
}

async function callMessageCreateApi(
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const headers = await getPermissionUpdateAuth(auth);
    const response = await fetch(ACCOUNTS_MESSAGE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Message creation failed');
    }

    return response.json().catch(() => ({}));
}

async function callMessageReactionApi(
    method: 'POST' | 'DELETE',
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const headers = await getPermissionUpdateAuth(auth);
    const response = await fetch(ACCOUNTS_MESSAGE_REACTIONS_API_URL, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Reaction update failed');
    }

    return response.json().catch(() => ({}));
}

async function callConversationRepairApi(
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const headers = await getPermissionUpdateAuth(auth);
    const response = await fetch(ACCOUNTS_KEY_REPAIR_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Conversation repair failed');
    }

    return response.json().catch(() => ({}));
}

async function callJoinRequestApi(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    payload?: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const headers = await getPermissionUpdateAuth(auth);
    const response = await fetch(ACCOUNTS_JOIN_REQUESTS_API_URL, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Join request update failed');
    }

    return response.json().catch(() => ({}));
}

async function fetchKeyMapping(resourceType: string, resourceId: string, grantee: string) {
    const res = await tablesDB.listRows(KEY_MAPPING_DB, KEY_MAPPING_TABLE, [
        Query.equal('resourceType', resourceType),
        Query.equal('resourceId', resourceId),
        Query.equal('grantee', grantee),
        Query.limit(1),
    ]);

    return res.rows[0] || null;
}

async function fetchProfilePublicKey(userId: string) {
    try {
        const profile = await UsersService.getProfileById(userId);
        return profile?.publicKey || null;
    } catch {
        return null;
    }
}

async function unwrapKeyMapping(row: any, fallbackUserId?: string) {
    if (!row?.wrappedKey || !row?.grantee) return null;

    let metadata: Record<string, any> = {};
    try {
        metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
        metadata = {};
    }

    const wrappedByPublicKey = metadata.wrappedByPublicKey
        || (metadata.wrappedBy ? await fetchProfilePublicKey(metadata.wrappedBy) : null)
        || (fallbackUserId ? await fetchProfilePublicKey(fallbackUserId) : null);

    if (!wrappedByPublicKey) {
        return null;
    }

    const key = await ecosystemSecurity.unwrapKeyWithECDH(row.wrappedKey, wrappedByPublicKey);
    return key || null;
}

async function fetchConversationKeyFromLockbox(conversationId: string, userId: string, creatorId?: string) {
    const row = await fetchKeyMapping('chat', conversationId, userId);
    if (!row) return null;
    return unwrapKeyMapping(row, creatorId || userId);
}

async function fetchEpochKeyForConversation(conversationId: string, userId: string, messageCreatedAt?: string | null) {
    const epochsRes = await tablesDB.listRows(APPWRITE_CONFIG.DATABASES.CHAT, EPOCHS_TABLE, [
        Query.equal('resourceId', conversationId),
        Query.orderDesc('epochNumber'),
        Query.limit(50),
    ]);

    const epochs = epochsRes.rows || [];
    const messageTime = messageCreatedAt ? new Date(messageCreatedAt).getTime() : Number.NaN;

    for (const epoch of epochs) {
        if (Number.isFinite(messageTime)) {
            const epochTime = new Date(epoch.$createdAt || epoch.createdAt || 0).getTime();
            if (epochTime > messageTime) {
                continue;
            }
        }

        const row = await fetchKeyMapping('epoch', epoch.$id, userId);
        const key = await unwrapKeyMapping(row, epoch.createdBy || userId);
        if (key) return key;
    }

    return null;
}

async function resolveConversationKey(
    conversation: any,
    userId: string,
    messageCreatedAt?: string | null,
    auth?: { jwt?: string; cookie?: string },
    repairAttempted = false,
) {
    if (!conversation?.$id || !userId) return null;

    if (ecosystemSecurity.status.isUnlocked && !ecosystemSecurity.status.hasIdentity) {
        try {
            await ecosystemSecurity.ensureE2EIdentity(userId);
        } catch (error) {
            console.warn('[ChatService] Failed to initialize E2E identity before key resolution:', error);
            return null;
        }
    }

    const cached = conversationKeyCache.get(conversation.$id);
    if (cached && !messageCreatedAt) {
        return cached;
    }

    if (conversation.type === 'group' && String(conversation.encryptionVersion || '').toUpperCase() === 'T4') {
        const epochKey = await fetchEpochKeyForConversation(conversation.$id, userId, messageCreatedAt);
        if (epochKey && !messageCreatedAt) {
            conversationKeyCache.set(conversation.$id, epochKey);
        }
        return epochKey;
    }

    const directKey = await fetchConversationKeyFromLockbox(conversation.$id, userId, conversation.creatorId);
    if (directKey) {
        if (!messageCreatedAt) {
            conversationKeyCache.set(conversation.$id, directKey);
        }
        return directKey;
    }

    const isSelfChat = conversation.type === 'direct'
        && Array.isArray(conversation.participants)
        && conversation.participants.length > 0
        && conversation.participants.every((participantId: string) => participantId === userId);

    if (isSelfChat && ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
        const rebuiltKey = await ecosystemSecurity.generateConversationKey();
        const publicKey = await ecosystemSecurity.ensureE2EIdentity(userId);
        if (!publicKey) return null;

        ecosystemSecurity.setConversationKey(conversation.$id, rebuiltKey);
        conversationKeyCache.set(conversation.$id, rebuiltKey);

        await syncLockboxRows([
            {
                resourceType: 'chat',
                resourceId: conversation.$id,
                grantee: userId,
                wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(rebuiltKey, publicKey),
                metadata: buildLockboxMetadata({
                    wrappedBy: userId,
                    wrappedByPublicKey: publicKey,
                    conversationId: conversation.$id,
                    conversationType: 'direct',
                    version: 't4',
                    repaired: true,
                }),
            },
        ]);

        return rebuiltKey;
    }

    if (!repairAttempted) {
        try {
          const repairResult = await callConversationRepairApi({
            userId,
            conversationId: conversation.$id,
          }, auth);

          if (repairResult?.identity) {
            const repairedProfile = await UsersService.getProfileById(userId, true);
            seedIdentityCache(repairedProfile);
          }

          conversationKeyCache.delete(conversation.$id);
          ecosystemSecurity.clearConversationKey(conversation.$id);
          return await resolveConversationKey(conversation, userId, messageCreatedAt, auth, true);
        } catch (error) {
          console.warn('[ChatService] Conversation repair failed:', error);
        }
    }

    return null;
}

async function syncLockboxRows(entries: LockboxEntry[], auth?: { jwt?: string; cookie?: string }) {
    if (!entries.length) return [];
    return callPermissionsApi('POST', { action: 'grant', keyMappings: entries }, auth);
}

async function syncConversationAccess(
    conversationId: string,
    participantIds: string[],
    permission: 'read' | 'write' = 'read',
    ownerId?: string
) {
    const targets = Array.from(new Set(participantIds.filter(Boolean)));
    if (!conversationId || targets.length === 0) return;
    return callPermissionsApi('POST', {
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: CONV_TABLE,
        rowId: conversationId,
        targetUserIds: targets,
        permission,
        ownerId,
        action: 'grant',
    });
}

async function syncConversationAvatarAccess(
    avatarFileId: string | null,
    participantIds: string[],
    auth?: { jwt?: string; cookie?: string }
) {
    if (!avatarFileId) return null;
    const targets = uniqueIds(participantIds);
    if (targets.length === 0) return null;

    return callPermissionsApi('POST', {
        storageBucketId: APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS,
        fileId: avatarFileId,
        targetUserIds: targets,
        permission: 'read',
        action: 'grant',
    }, auth);
}

async function revokeConversationAvatarAccess(
    avatarFileId: string | null,
    participantIds: string[],
    auth?: { jwt?: string; cookie?: string }
) {
    if (!avatarFileId) return null;
    const targets = uniqueIds(participantIds);
    if (targets.length === 0) return null;

    return callPermissionsApi('DELETE', {
        storageBucketId: APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS,
        fileId: avatarFileId,
        targetUserIds: targets,
        permission: 'read',
        action: 'revoke',
    }, auth);
}

export const ChatService = {
    async _unwrapConversationKey(conv: any, myUserId: string): Promise<CryptoKey | null> {
        const key = await resolveConversationKey(conv, myUserId);
        if (key) {
            conversationKeyCache.set(conv.$id, key);
        }
        return key;
    },

    getConversationPreviewSnapshot(conversationId: string) {
        return getConversationPreviewCache(conversationId);
    },

    rememberConversationPreview(conversationId: string, preview: {
        lastMessageId: string;
        lastMessageText: string;
        lastMessageAt: string;
        lastMessageSenderId?: string | null;
    } | null) {
        setConversationPreviewCache(conversationId, preview);
    },

    clearConversationPreviewCache(conversationId?: string) {
        if (conversationId) {
            conversationPreviewCache.delete(conversationId);
            return;
        }

        conversationPreviewCache.clear();
    },

    async rewrapConversationKeys(conversationId: string, auth?: { jwt?: string; cookie?: string }) {
        if (!conversationId) return null;
        const repairResult = await callConversationRepairApi({
            conversationId,
        }, auth);

        conversationKeyCache.delete(conversationId);
        ecosystemSecurity.clearConversationKey(conversationId);
        return repairResult;
    },
    async getConversationById(conversationId: string, userId?: string) {
        const conv = await tablesDB.getRow(DB_ID, CONV_TABLE, conversationId);
        const normalizedConversation = await normalizeConversationRow(conv);
        const hydrated = await this._hydrateConversationParticipants(normalizedConversation);
        return await this._decryptConversation(hydrated, userId);
    },

    async _hydrateConversationParticipants(conversation: any) {
        if (!conversation?.$id) return conversation;
        const existingParticipants = Array.isArray(conversation.participants) ? conversation.participants.filter(Boolean) : [];
        if (existingParticipants.length > 0) {
            return conversation;
        }

        try {
            const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
                Query.equal('conversationId', conversation.$id),
                Query.limit(1000),
            ]);

            const participants = Array.from(new Set(
                memberRows.rows
                    .map((row: any) => row.userId)
                    .filter(Boolean)
            ));

            if (!participants.length) return conversation;

            return { ...conversation, participants };
        } catch (_e) {
            return conversation;
        }
    },

    async _decryptConversation(conv: any, userId?: string) {
        if (!conv.isEncrypted || !ecosystemSecurity.status.isUnlocked) return conv;
        let convKey: CryptoKey | null = null;
        try {
            if (userId) {
                convKey = await resolveConversationKey(conv, userId);
            } else {
                convKey = conversationKeyCache.get(conv.$id) || ecosystemSecurity.getConversationKey(conv.$id);
            }
        } catch (error) {
            console.warn('[ChatService] Failed to resolve conversation key:', error);
            return conv;
        }

        if (!convKey) return conv;

        if (conv.name && conv.name.length > 40) {
            try {
                conv.name = await ecosystemSecurity.decryptWithKey(conv.name, convKey);
            } catch (error) {
                console.warn('[ChatService] Failed to decrypt conversation name, keeping plaintext:', error);
            }
        }
        if (conv.lastMessageText && conv.lastMessageText.length > 40) {
            try {
                conv.lastMessageText = await ecosystemSecurity.decryptWithKey(conv.lastMessageText, convKey);
            } catch (error) {
                console.warn('[ChatService] Failed to decrypt conversation preview, keeping plaintext:', error);
            }
        }
        return conv;
    },

    async getConversations(userId: string) {
        console.log('[ChatService] getConversations for:', userId);

        const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
            Query.equal('userId', userId),
            Query.limit(1000)
        ]).catch(() => ({ rows: [] as any[] }));

        const conversationIds = Array.from(new Set(
            (memberRows.rows || [])
                .map((row: any) => row.conversationId)
                .filter(Boolean)
        ));

        let conversationRows: any[] = [];
        let memberRowsByConversation = new Map<string, string[]>();

        if (conversationIds.length > 0) {
            const conversationsResult = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                Query.equal('$id', conversationIds),
                Query.limit(conversationIds.length)
            ]).catch(() => ({ rows: [] as any[] }));

            conversationRows = conversationsResult.rows || [];

            const allMembers = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
                Query.equal('conversationId', conversationIds),
                Query.limit(Math.min(1000, conversationIds.length * 10))
            ]).catch(() => ({ rows: [] as any[] }));

            memberRowsByConversation = new Map<string, string[]>();
            for (const row of allMembers.rows || []) {
                if (!row?.conversationId || !row?.userId) continue;
                const existing = memberRowsByConversation.get(row.conversationId) || [];
                if (!existing.includes(row.userId)) existing.push(row.userId);
                memberRowsByConversation.set(row.conversationId, existing);
            }
        } else {
            const legacy = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                Query.contains('participants', userId),
                Query.limit(100)
            ]).catch(() => ({ rows: [] as any[] }));
            conversationRows = legacy.rows || [];
            for (const conversation of conversationRows) {
                const participants = Array.isArray(conversation.participants) ? conversation.participants.filter(Boolean) : [];
                if (participants.length) memberRowsByConversation.set(conversation.$id, participants);
            }
        }

        const previewConversationIds = conversationIds.length > 0
            ? conversationIds
            : conversationRows.map((conversation) => conversation.$id).filter(Boolean);
        const needsPreviewHydration = conversationRows.some((conversation) => !conversation.lastMessageAt || !conversation.lastMessageText);
        const latestMessageByConversation = new Map<string, any>();

        if (needsPreviewHydration && previewConversationIds.length > 0) {
            const recentMessagesResult = await tablesDB.listRows(DB_ID, MSG_TABLE, [
                Query.equal('conversationId', previewConversationIds),
                Query.orderDesc('createdAt'),
                Query.limit(Math.min(1000, previewConversationIds.length * 20))
            ]).catch(() => ({ rows: [] as any[] }));

            for (const message of recentMessagesResult.rows || []) {
                if (message?.conversationId && !latestMessageByConversation.has(message.conversationId)) {
                    latestMessageByConversation.set(message.conversationId, message);
                }
            }
        }

        const rows = await Promise.all(conversationRows.map(async (conversation: any) => {
            const participants = memberRowsByConversation.get(conversation.$id) || conversation.participants || [];
            const normalizedConversation = {
                ...conversation,
                participants: Array.from(new Set((participants || []).filter(Boolean)))
            };
            const cachedPreview = getConversationPreviewCache(conversation.$id);
            const latestMessage = latestMessageByConversation.get(conversation.$id);
            const hydratedConversation = latestMessage ? {
                ...normalizedConversation,
                lastMessageAt: getMessageActivityAt(latestMessage) || normalizedConversation.lastMessageAt,
                lastMessageText: await getMessagePreview(latestMessage, conversation.$id)
            } : normalizedConversation;

            const hydratedAt = new Date(getConversationActivityAt(hydratedConversation) || 0).getTime();
            const cachedAt = cachedPreview ? new Date(cachedPreview.lastMessageAt || 0).getTime() : -1;
            const withCache = cachedPreview && (cachedAt >= hydratedAt || !hydratedConversation.lastMessageText) ? {
                ...hydratedConversation,
                ...cachedPreview,
            } : hydratedConversation;

            return this._decryptConversation(withCache, userId);
        }));

        rows.sort((a, b) => {
            const timeA = new Date(getConversationActivityAt(a) || 0).getTime();
            const timeB = new Date(getConversationActivityAt(b) || 0).getTime();
            return timeB - timeA;
        });

        return {
            total: rows.length,
            rows
        };
    },

    async createConversation(participants: string[], type: 'direct' | 'group' = 'direct', name?: string) {
        if (!ecosystemSecurity.status.isUnlocked) {
            throw new Error('Vault must be unlocked before creating conversations');
        }

        if (!ecosystemSecurity.status.hasIdentity) {
            throw new Error('E2E identity must be initialized before creating conversations');
        }

        const creatorId = participants[0];
        const isSelf = type === 'direct' && participants.length === 1 && participants[0] === participants[participants.length - 1];
        const uniqueParticipants = isSelf ? [participants[0], participants[0]] : Array.from(new Set(participants));

        // GUARD: Prevent duplicate direct chats by checking server-side first
        if (type === 'direct') {
            const creatorMemberships = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
                Query.equal('userId', creatorId),
                Query.limit(1000)
            ]).catch(() => ({ rows: [] as any[] }));

            const candidateConversationIds = Array.from(new Set(
                (creatorMemberships.rows || [])
                    .map((row: any) => row.conversationId)
                    .filter(Boolean)
            ));

            if (candidateConversationIds.length > 0) {
                const existing = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                    Query.equal('$id', candidateConversationIds),
                    Query.equal('type', 'direct'),
                    Query.limit(candidateConversationIds.length)
                ]).catch(() => ({ rows: [] as any[] }));

                const candidateRows = existing.rows || [];
                if (candidateRows.length > 0) {
                    const membershipRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
                        Query.equal('conversationId', candidateConversationIds),
                        Query.limit(Math.min(1000, candidateConversationIds.length * 10))
                    ]).catch(() => ({ rows: [] as any[] }));

                    const participantsByConversation = new Map<string, string[]>();
                    for (const row of membershipRows.rows || []) {
                        if (!row?.conversationId || !row?.userId) continue;
                        const current = participantsByConversation.get(row.conversationId) || [];
                        if (!current.includes(row.userId)) current.push(row.userId);
                        participantsByConversation.set(row.conversationId, current);
                    }

                    const targetParticipantSet = canonicalizeParticipantsForMatch(uniqueParticipants);
                    for (const conversation of candidateRows) {
                        const existingParticipantSet = canonicalizeParticipantsForMatch(
                            participantsByConversation.get(conversation.$id) || []
                        );

                        if (arraysEqual(existingParticipantSet, targetParticipantSet)) {
                            console.log('[ChatService] Direct chat already exists, returning existing:', conversation.$id);
                            return conversation;
                        }
                    }
                }
            }
        }

        let convKey: CryptoKey | null = null;

        // E2E Layer: Only if vault is unlocked and identity is ready
        if (ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
            // 1. Generate unique Group/Conversation Key
            convKey = await ecosystemSecurity.generateConversationKey();
        }

        // 3. Encrypt name and metadata if it's a group
        let encryptedName = name;
        if (name && convKey && ecosystemSecurity.status.isUnlocked) {
            encryptedName = await ecosystemSecurity.encryptWithKey(name, convKey);
        }

        const conversationPermissions = buildConversationMemberPermissions(uniqueParticipants, creatorId);

        const now = new Date().toISOString();

        const newConv = await tablesDB.createRow(DB_ID, CONV_TABLE, ID.unique(), {
            participants: uniqueParticipants,
            participantCount: uniqueParticipants.length,
            type: type || 'direct',
            name: encryptedName || 'Direct Chat',
            inviteMeta: null,
            inviteLink: null,
            inviteLinkExpiry: null,
            creatorId,
            admins: type === 'group' ? [creatorId] : uniqueParticipants,
            isPinned: [],
            isMuted: [],
            isArchived: [],
            tags: [],
            isEncrypted: !!convKey,
            encryptionVersion: convKey ? 'T4' : '1.0',
            createdAt: now,
            updatedAt: now,
        }, conversationPermissions);

        const memberRows = await Promise.all(uniqueParticipants.map((participantId) =>
            tablesDB.createRow(
                DB_ID,
                CONV_MEMBERS_TABLE,
                ID.unique(),
                {
                    conversationId: newConv.$id,
                    userId: participantId,
                },
                buildConversationMemberPermissions(uniqueParticipants, creatorId)
            ).catch(() => null)
        ));

        await Promise.all(memberRows.filter(Boolean).map((memberRow: any) =>
            callPermissionsApi('POST', {
                databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                tableId: CONV_MEMBERS_TABLE,
                rowId: memberRow.$id,
                ownerId: creatorId,
                targetUserIds: uniqueParticipants,
                permission: 'read',
                action: 'grant',
            }).catch((error) => {
                console.error('[ChatService] Failed to grant conversation member access:', error);
                throw error;
            })
        ));

        // Cache the local key for this session
        if (convKey) {
            ecosystemSecurity.setConversationKey(newConv.$id, convKey);
            conversationKeyCache.set(newConv.$id, convKey);
            try {
                const creatorPublicKey = ecosystemSecurity.status.hasIdentity
                    ? await ecosystemSecurity.ensureE2EIdentity(creatorId)
                    : null;

                if (creatorPublicKey) {
                    const directLockboxRows: LockboxEntry[] = await Promise.all(uniqueParticipants.map(async (participantId) => {
                        const profile = await UsersService.getProfileById(participantId);
                        if (!profile?.publicKey) return null;

                        return {
                            resourceType: 'chat',
                            resourceId: newConv.$id,
                            grantee: participantId,
                            wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(convKey, profile.publicKey),
                            metadata: buildLockboxMetadata({
                                wrappedBy: creatorId,
                                wrappedByPublicKey: creatorPublicKey,
                                conversationId: newConv.$id,
                                conversationType: type,
                                version: 't4',
                            }),
                        };
                    })).then((rows) => rows.filter(Boolean) as LockboxEntry[]);

                    if (type === 'group') {
                        await callPermissionsApi('POST', {
                            action: 'rotate_epoch',
                            resourceId: newConv.$id,
                            ownerId: creatorId,
                            participantUserIds: uniqueParticipants,
                            epochNumber: 1,
                            keyMappings: directLockboxRows.map((entry) => ({
                                ...entry,
                                resourceType: 'epoch',
                                resourceId: newConv.$id,
                            })),
                        });
                    } else if (directLockboxRows.length > 0) {
                        await syncLockboxRows(directLockboxRows);
                    }

                    const recipientIds = uniqueParticipants.filter((id) => id !== creatorId);
                    if (recipientIds.length > 0) {
                        await syncConversationAccess(
                            newConv.$id,
                            recipientIds,
                            type === 'direct' ? 'write' : 'read',
                            creatorId
                        );
                    }
                }
            } catch (lockboxErr) {
                console.error('[ChatService] Failed to persist lockbox rows:', lockboxErr);
            }
        }

        return newConv;
    },

    async sendMessage(
        conversationId: string, 
        senderId: string, 
        content: string, 
        type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'call_signal' | 'system' | 'attachment' = 'text', 
        attachments: string[] = [], 
        replyTo?: string,
        metadata?: any,
        permissionSyncAuth?: { jwt?: string; cookie?: string }
    ) {
        let conversation: any = null;

        // E2E Layer: Universal Handshake Protocol
        let finalContent = content;

        try {
        const rawConversation = await tablesDB.getRow(DB_ID, CONV_TABLE, conversationId);
            conversation = await this._hydrateConversationParticipants(await normalizeConversationRow(rawConversation));
        } catch (_e) {
            conversation = null;
        }

        if (conversation?.participants?.length && !conversation.participants.includes(senderId)) {
            throw new Error('You are not a participant in this conversation');
        }

        if ((type === 'text' || type === 'attachment') && ecosystemSecurity.status.isUnlocked) {
            const convKey = conversation ? await resolveConversationKey(conversation, senderId, null, permissionSyncAuth) : null;
            if (!convKey) throw new Error('Conversation key not available');
            finalContent = await ecosystemSecurity.encryptWithKey(content, convKey);
        }

        const message = await callMessageCreateApi({
            conversationId,
            senderId,
            content: finalContent,
            type,
            attachments,
            replyTo,
        }, permissionSyncAuth);

        if (type === 'text') {
            notifyMessageStreak(conversation, senderId, conversationId).catch((error) => {
                console.error('[ChatService] Failed to queue message streak email', error);
            });
        }

        // 2. Best-effort conversation preview update.
        // In a client-only model only the creator can mutate the shared row, so list UIs must
        // derive freshness from message activity instead of depending on this always succeeding.
        if (conversation?.creatorId === senderId) {
            try {
                const now = new Date().toISOString();
                await tablesDB.updateRow(DB_ID, CONV_TABLE, conversationId, {
                    lastMessageId: message.$id,
                    lastMessageAt: now,
                    lastMessageText: type === 'text' ? finalContent : `[${type}]`,
                });
            } catch (_e) {
                console.warn('[ChatService] Conversation preview update skipped');
            }
        }

        setConversationPreviewCache(conversationId, {
            lastMessageId: message.$id,
            lastMessageText: type === 'text' || type === 'attachment' ? content : `[${type}]`,
            lastMessageAt: message.$createdAt || message.createdAt || new Date().toISOString(),
            lastMessageSenderId: senderId,
        });

        // 3. (Background) Re-keying check
        if (ecosystemSecurity.status.isUnlocked && conversation?.creatorId === senderId) {
            this.rewrapConversationKeys(conversationId, permissionSyncAuth).catch(err =>
                console.warn("[ChatService] Background re-wrap failed:", err)
            );
        }

        return message;
    },

    async reactToMessage(
        conversationId: string,
        messageId: string,
        emoji: string,
        permissionSyncAuth?: { jwt?: string; cookie?: string }
    ) {
        return callMessageReactionApi('POST', {
            conversationId,
            messageId,
            emoji,
        }, permissionSyncAuth);
    },

    async removeMessageReaction(
        conversationId: string,
        messageId: string,
        emoji: string,
        permissionSyncAuth?: { jwt?: string; cookie?: string }
    ) {
        return callMessageReactionApi('DELETE', {
            conversationId,
            messageId,
            emoji,
        }, permissionSyncAuth);
    },

    async getMessages(conversationId: string, limit = 50, offset = 0, userId?: string) {
        // Ensure UI has explicitly unwrapped the Conversation Key before fetching messages
        const _conv = await this.getConversationById(conversationId, userId);
        const convKey = userId ? await resolveConversationKey(_conv, userId) : conversationKeyCache.get(conversationId) || ecosystemSecurity.getConversationKey(conversationId);

        const res = await tablesDB.listRows(DB_ID, MSG_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.orderDesc('createdAt'),
            Query.limit(limit),
            Query.offset(offset)
        ]);

        // Decrypt messages in parallel
        res.rows = await Promise.all(res.rows.map(async (msg: any) => {
            const isEncrypted = ecosystemSecurity.status.isUnlocked && (
                (msg.type === 'text' && msg.content && msg.content.length > 40) ||
                (msg.metadata && msg.metadata.length > 40)
            );

            if (isEncrypted) {
                let messageKey = _conv?.type === 'group' && String(_conv?.encryptionVersion || '').toUpperCase() === 'T4' && userId
                    ? await resolveConversationKey(_conv, userId, msg.createdAt)
                    : convKey;
                if (!messageKey && userId) {
                    await UsersService.forceSyncProfileWithIdentity({ $id: userId });
                    messageKey = _conv?.type === 'group' && String(_conv?.encryptionVersion || '').toUpperCase() === 'T4'
                        ? await resolveConversationKey(_conv, userId, msg.createdAt)
                        : await resolveConversationKey(_conv, userId);
                }
                if (!messageKey) return msg;

                if (msg.type === 'text' && msg.content && msg.content.length > 40) {
                    msg.content = await ecosystemSecurity.decryptWithKey(msg.content, messageKey);
                }
                if (msg.metadata && msg.metadata.length > 40) {
                    const decryptedMeta = await ecosystemSecurity.decryptWithKey(msg.metadata, messageKey);
                    try {
                        msg.metadata = JSON.parse(decryptedMeta);
                    } catch {
                        msg.metadata = decryptedMeta;
                    }
                }
            }
            return msg;
        }));

        const latestMessage = res.rows[0];
        if (latestMessage) {
            setConversationPreviewCache(conversationId, {
                lastMessageId: latestMessage.$id,
                lastMessageText: latestMessage.type === 'text' || latestMessage.type === 'attachment'
                    ? String(latestMessage.content || '')
                    : `[${latestMessage.type || 'message'}]`,
                lastMessageAt: getMessageActivityAt(latestMessage) || latestMessage.$createdAt || latestMessage.$updatedAt || new Date().toISOString(),
                lastMessageSenderId: latestMessage.senderId || null,
            });
        }

        return res;
    },

    /**
     * Wipes all messages authored by the user in this conversation.
     * Hard-deletes documents from the server.
     */
    async wipeMyFootprint(conversationId: string, userId: string) {
        console.log(`[ChatService] Wiping footprint for ${userId} in ${conversationId}`);
        // 1. Fetch all messages sent by this user
        const res = await tablesDB.listRows(DB_ID, MSG_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.equal('senderId', userId),
            Query.limit(1000) // Max limit for a wipe
        ]);

        // 2. Bulk delete in parallel batches of 10
        const batches = [];
        for (let i = 0; i < res.rows.length; i += 10) {
            const batch = res.rows.slice(i, i + 10).map(msg => tablesDB.deleteRow(DB_ID, MSG_TABLE, msg.$id));
            batches.push(Promise.all(batch));
        }
        await Promise.all(batches);
        return { success: true, count: res.total };
    },

    /**
     * Sets a 'clearedAt' timestamp for the user in the conversation settings.
     * This is a 'soft-delete' that provides a clean slate without affecting others.
     */
    async clearChatForMe(conversationId: string, userId: string) {
        const conv = await tablesDB.getRow(DB_ID, CONV_TABLE, conversationId);
        let settings: any = {};

        try {
            if (conv.settings) {
                const decryptedSettings = await ecosystemSecurity.decrypt(conv.settings);
                settings = JSON.parse(decryptedSettings);
            }
        } catch (_e: unknown) {
            // Settings might be empty or unencrypted
        }

        if (!settings.clearedAt) settings.clearedAt = {};
        settings.clearedAt[userId] = new Date().toISOString();

        const encryptedSettings = await ecosystemSecurity.encrypt(JSON.stringify(settings));

        return await tablesDB.updateRow(DB_ID, CONV_TABLE, conversationId, {
            settings: encryptedSettings
        });
    },

    /**
     * Entirely deletes all messages in a conversation (Reserved for Saved Messages/Self-Chat)
     */
    async nuclearWipe(conversationId: string) {
        const res = await tablesDB.listRows(DB_ID, MSG_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.limit(1000)
        ]);

        const batches = [];
        for (let i = 0; i < res.rows.length; i += 10) {
            const batch = res.rows.slice(i, i + 10).map(msg => tablesDB.deleteRow(DB_ID, MSG_TABLE, msg.$id));
            batches.push(Promise.all(batch));
        }
        await Promise.all(batches);
        return { success: true };
    },

    async deleteConversationFully(conversationId: string) {
        const conversation = await this.getConversationById(conversationId).catch(() => null);

        const deleteAllRows = async (dbId: string, tableId: string, query: any[]) => {
            const rows = await tablesDB.listRows(dbId, tableId, query).catch(() => ({ rows: [] as any[] }));
            const batches: Promise<unknown>[] = [];
            for (let i = 0; i < (rows.rows || []).length; i += 10) {
                const batch = rows.rows.slice(i, i + 10).map((row: any) => tablesDB.deleteRow(dbId, tableId, row.$id));
                batches.push(Promise.all(batch));
            }
            await Promise.all(batches);
        };

        await this.nuclearWipe(conversationId);

        await deleteAllRows(DB_ID, CONV_MEMBERS_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.limit(1000)
        ]);

        await deleteAllRows(DB_ID, EPOCHS_TABLE, [
            Query.equal('resourceId', conversationId),
            Query.limit(1000)
        ]);

        await deleteAllRows(KEY_MAPPING_DB, KEY_MAPPING_TABLE, [
            Query.equal('resourceId', conversationId),
            Query.limit(1000)
        ]);

        await tablesDB.deleteRow(DB_ID, CONV_TABLE, conversationId);
        conversationKeyCache.delete(conversationId);

        return { success: true, conversation };
    },

    async updateConversation(conversationId: string, data: Partial<{
        name: string;
        description: string;
        avatarUrl: string | null;
        avatarFileId: string | null;
        settings: string;
        participants: string[];
        admins: string[];
        isPinned: string[];
        isMuted: string[];
        isArchived: string[];
        tags: string[];
        inviteLink: string | null;
        inviteLinkExpiry: string | null;
        inviteMeta: string | null;
    }>) {
        const current = await this.getConversationById(conversationId).catch(() => null);
        const patch: Record<string, unknown> = { ...data };
        if (Array.isArray(patch.participants)) {
            patch.participants = uniqueIds(patch.participants as string[]);
            patch.participantCount = (patch.participants as string[]).length;
        }
        const nextInviteLink = Object.prototype.hasOwnProperty.call(patch, 'inviteLink')
            ? patch.inviteLink
            : current?.inviteLink;
        const inviteEnabled = Boolean(nextInviteLink && nextInviteLink === conversationId);

        if (inviteEnabled && !Object.prototype.hasOwnProperty.call(patch, 'inviteMeta')) {
            patch.inviteMeta = buildInviteMeta(current, patch);
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'avatarUrl') || Object.prototype.hasOwnProperty.call(patch, 'avatarFileId')) {
            patch.avatarUrl = typeof patch.avatarUrl === 'string' ? patch.avatarUrl : patch.avatarUrl ?? null;
            patch.avatarFileId = typeof patch.avatarFileId === 'string' ? patch.avatarFileId : patch.avatarFileId ?? null;
        }

        return await tablesDB.updateRow(DB_ID, CONV_TABLE, conversationId, patch);
    },

    async addParticipant(conversationId: string, userId: string) {
        const conv = await this.getConversationById(conversationId);
        const participants = conv.participants || [];
        const requiresRotation = conv?.type === 'group' && String(conv?.encryptionVersion || '').toUpperCase() === 'T4';
        if (requiresRotation && (!ecosystemSecurity.status.isUnlocked || !ecosystemSecurity.status.hasIdentity)) {
            throw new Error('Security vault is locked; cannot rotate group epoch');
        }
        if (!participants.includes(userId)) {
            const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
                Query.equal('conversationId', conversationId),
                Query.equal('userId', userId),
                Query.limit(1)
            ]).catch(() => ({ rows: [] as any[] }));

            if (!memberRows.rows.length) {
                const memberRow = await tablesDB.createRow(DB_ID, CONV_MEMBERS_TABLE, ID.unique(), {
                    conversationId,
                    userId
                }, buildConversationMemberPermissions([...participants, userId], conv.creatorId || participants[0] || userId)).catch(() => null);

                if (memberRow?.$id) {
                    await callPermissionsApi('POST', {
                        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                        tableId: CONV_MEMBERS_TABLE,
                        rowId: memberRow.$id,
                        ownerId: conv.creatorId || participants[0] || userId,
                        targetUserIds: [...participants, userId],
                        permission: 'read',
                        action: 'grant',
                    });
                }
            }

            const updatedParticipants = await getConversationMemberSnapshot(conversationId, [...participants, userId]);
            const updated = await this.updateConversation(conversationId, {
                participants: updatedParticipants,
            });
            await syncConversationAccess(
                conversationId,
                [userId],
                conv.type === 'direct' ? 'write' : 'read',
                conv.creatorId || participants[0] || userId
            );
            await syncConversationAvatarAccess(
                conv.avatarFileId || null,
                updatedParticipants,
            );

            if (requiresRotation && ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
                const nextKey = await ecosystemSecurity.generateConversationKey();
                ecosystemSecurity.setConversationKey(conversationId, nextKey);
                conversationKeyCache.set(conversationId, nextKey);

                const epochsRes = await tablesDB.listRows(DB_ID, EPOCHS_TABLE, [
                    Query.equal('resourceId', conversationId),
                    Query.orderDesc('epochNumber'),
                    Query.limit(1),
                ]).catch(() => ({ rows: [] as any[] }));
                const nextEpochNumber = Number(epochsRes.rows?.[0]?.epochNumber || 0) + 1;

                const creatorProfile = await UsersService.getProfileById(conv.creatorId);
                const creatorPublicKey = creatorProfile?.publicKey || null;
                if (!creatorPublicKey) {
                    throw new Error('Creator public key missing; cannot rotate group key');
                }

                const keyMappings: LockboxEntry[] = [];
                for (const participantId of updatedParticipants) {
                    const profile = await UsersService.getProfileById(participantId);
                    if (!profile?.publicKey) {
                        throw new Error(`Missing public key for member ${participantId}`);
                    }

                    keyMappings.push({
                        resourceType: 'epoch',
                        resourceId: conversationId,
                        grantee: participantId,
                        wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(nextKey, profile.publicKey),
                        metadata: buildLockboxMetadata({
                            wrappedBy: conv.creatorId,
                            wrappedByPublicKey: creatorPublicKey,
                            conversationId,
                            conversationType: 'group',
                            version: 't4',
                            rotation: 'member-added',
                        }),
                    });
                }

                await callPermissionsApi('POST', {
                    action: 'rotate_epoch',
                    resourceId: conversationId,
                    ownerId: conv.creatorId || participants[0] || userId,
                    participantUserIds: updatedParticipants,
                    epochNumber: nextEpochNumber,
                    keyMappings,
                });
            }
            return updated;
        }
        return conv;
    },

    async removeParticipant(conversationId: string, userId: string) {
        const conv = await this.getConversationById(conversationId);
        const requiresRotation = conv?.type === 'group' && String(conv?.encryptionVersion || '').toUpperCase() === 'T4';
        if (requiresRotation && (!ecosystemSecurity.status.isUnlocked || !ecosystemSecurity.status.hasIdentity)) {
            throw new Error('Security vault is locked; cannot rotate group epoch');
        }

        const participants = (conv.participants || []).filter((id: string) => id !== userId);
        const admins = (conv.admins || []).filter((id: string) => id !== userId);

        const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.equal('userId', userId),
            Query.limit(1)
        ]).catch(() => ({ rows: [] as any[] }));
        if (memberRows.rows[0]?.$id) {
            await tablesDB.deleteRow(DB_ID, CONV_MEMBERS_TABLE, memberRows.rows[0].$id).catch(() => null);
        }

        const updatedParticipants = await getConversationMemberSnapshot(conversationId, participants);
        const updated = await this.updateConversation(conversationId, {
            participants: updatedParticipants,
            admins
        });
        await revokeConversationAvatarAccess(
            conv.avatarFileId || null,
            [userId],
        );
        await callPermissionsApi('DELETE', {
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: CONV_TABLE,
            rowId: conversationId,
            targetUserIds: [userId],
            resourceType: 'chat',
            resourceId: conversationId,
        });

        if (conv?.type === 'group' && String(conv?.encryptionVersion || '').toUpperCase() === 'T4' && participants.length > 0 && ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
            const newKey = await ecosystemSecurity.generateConversationKey();
            ecosystemSecurity.setConversationKey(conversationId, newKey);
            conversationKeyCache.set(conversationId, newKey);

            const creatorProfile = await UsersService.getProfileById(conv.creatorId);
            const creatorPublicKey = creatorProfile?.publicKey || null;
            if (creatorPublicKey) {
                const keyMappings: LockboxEntry[] = [];
                for (const participantId of participants) {
                    const profile = await UsersService.getProfileById(participantId);
                    if (!profile?.publicKey) continue;
                    keyMappings.push({
                        resourceType: 'epoch',
                        resourceId: conversationId,
                        grantee: participantId,
                        wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(newKey, profile.publicKey),
                        metadata: buildLockboxMetadata({
                            wrappedBy: conv.creatorId,
                            wrappedByPublicKey: creatorPublicKey,
                            conversationId,
                            conversationType: 'group',
                            version: 't4',
                            rotation: 'member-removal',
                        }),
                    });
                }

                if (keyMappings.length > 0) {
                    await callPermissionsApi('POST', {
                        action: 'rotate_epoch',
                        resourceId: conversationId,
                        participantUserIds: participants,
                        keyMappings,
                    });
                }
            }
        }

        return updated;
    },

    async getJoinRequests(conversationId: string) {
        const { rows } = await tablesDB.listRows(DB_ID, APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS, [
            Query.equal('resourceType', 'chat.conversation'),
            Query.equal('resourceId', conversationId),
            Query.equal('status', 'pending'),
            Query.limit(1000),
        ]);

        return rows;
    },

    async updateConversationInvite(conversationId: string, enabled: boolean) {
        return await this.updateConversation(conversationId, {
            inviteLink: enabled ? conversationId : null,
            inviteLinkExpiry: null,
        });
    },

    async updateConversationAvatar(conversationId: string, file: File, auth?: { jwt?: string; cookie?: string }) {
        const current = await this.getConversationById(conversationId);
        const existingParticipants = uniqueIds([
            ...(Array.isArray(current?.participants) ? current.participants : []),
            current?.creatorId,
            ...(Array.isArray(current?.admins) ? current.admins : []),
        ]);

        const uploaded = await storage.createFile(APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS, ID.unique(), file);
        try {
            await syncConversationAvatarAccess(uploaded.$id, existingParticipants, auth);
            return await this.updateConversation(conversationId, {
                avatarFileId: uploaded.$id,
                avatarUrl: buildGroupAvatarUrl(conversationId),
            });
        } catch (error) {
            await storage.deleteFile(APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS, uploaded.$id).catch(() => null);
            throw error;
        }
    },

    async resolveJoinRequest(
        resourceType: string,
        resourceId: string,
        requesterId: string,
        action: 'accept' | 'reject'
    ) {
        return callJoinRequestApi('PATCH', {
            resourceType,
            resourceId,
            requesterId,
            action,
        });
    },

    async cancelJoinRequest(resourceType: string, resourceId: string) {
        return callJoinRequestApi('DELETE', {
            resourceType,
            resourceId,
        });
    },

    async deleteMessage(messageId: string) {
        return await tablesDB.deleteRow(DB_ID, MSG_TABLE, messageId);
    },

    async updateMessage(messageId: string, data: Partial<{ content: string; type: string; readBy: string[] }>) {
        return await tablesDB.updateRow(DB_ID, MSG_TABLE, messageId, {
            ...data
        });
    },

    async markAsRead(messageId: string, userId: string) {
        try {
            const message = await tablesDB.getRow(DB_ID, MSG_TABLE, messageId);
            const readBy = message.readBy || [];
            if (!readBy.includes(userId)) {
                return await tablesDB.updateRow(DB_ID, MSG_TABLE, messageId, {
                    readBy: [...readBy, userId]
                });
            }
            return message;
        } catch (error: unknown) {
            console.error('Failed to mark message as read:', error);
            return null;
        }
    },

    async markConversationAsRead(conversationId: string, userId: string) {
        // Fetch unread messages in this conversation and mark them as read
        // Note: In a production environment, this might be better handled by a cloud function or a batch update
        const unreadMessages = await tablesDB.listRows(DB_ID, MSG_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.notContains('readBy', userId),
            Query.limit(100)
        ]);

        return Promise.all(unreadMessages.rows.map(msg => this.markAsRead(msg.$id, userId)));
    },
};
