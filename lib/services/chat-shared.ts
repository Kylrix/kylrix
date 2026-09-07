import { ID, Permission, Query, Role } from 'appwrite';
import { account, storage, tablesDB, getCurrentUser } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { KYLRIX_AUTH_URI, getEcosystemUrl } from '../constants';
import { getUserSubscriptionTier } from '@/lib/utils';
import { allowsGroupHangouts } from '@/lib/entitlements';
import { ecosystemSecurity } from '../ecosystem/security';
import { isValidX25519PublicKey } from '@/lib/crypto/public-key';
import { UsersService } from './users';
import { seedIdentityCache } from '@/lib/identity-cache';
import { sendKylrixEmailNotification } from '../email-notifications';
import { permissionsAction } from '@/lib/actions/permissions';
import {
    createMessageAction,
    repairConversationAction,
    toggleReactionAction,
    joinRequestAction as joinRequestServerAction,
    clearConversationFootprintAction,
    deleteConversationFullyAction,
    nuclearWipeConversationAction,
    getConversationsAction,
    clearChatForMeAction,
    updateConversationAction,
} from '@/lib/actions/chat';
import { LocalEngine } from '@/lib/services/LocalEngine';


export const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
export const CONV_MEMBERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS || 'conversationMembers';
export const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
export const EPOCHS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.EPOCHS;
export const KEY_MAPPING_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
export const KEY_MAPPING_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING;
export const GROUP_AVATAR_ROUTE = `${KYLRIX_AUTH_URI}/api/connect/group-avatar`;
export const conversationKeyCache = new Map<string, CryptoKey>();
export const conversationPreviewCache = new Map<string, {
    lastMessageId: string;
    lastMessageText: string;
    lastMessageAt: string;
    lastMessageSenderId?: string | null;
}>();
export const conversationsListCache = new Map<string, { rows: any[]; fetchedAt: number; authoritative: boolean }>();
export const CONVERSATIONS_LIST_TTL_MS = 5 * 60_000;

let conversationsFetchInflight: {
    userId: string;
    promise: Promise<{ total: number; rows: any[]; authoritative: boolean }>;
} | null = null;
export const conversationRosterCache = new Map<string, any>();
export const workspaceConversationInflight = new Map<string, Promise<any>>();

export function isUniqueConstraintError(error: unknown): boolean {
    const err = error as { code?: number; message?: string; type?: string };
    const message = String(err?.message || err?.type || '').toLowerCase();
    return err?.code === 409 || message.includes('unique') || message.includes('duplicate') || message.includes('already exists');
}

export async function findWorkspaceConversation(workspaceId: string) {
    try {
        const existing = await tablesDB.listRows(DB_ID, CONV_TABLE, [
            Query.equal('contextType', 'workspace'),
            Query.equal('contextId', workspaceId),
            Query.limit(1),
        ]);
        if (existing.rows?.length) return existing.rows[0];
    } catch {
        // Non-fatal, try fallback
    }

    try {
        const legacy = await tablesDB.listRows(DB_ID, CONV_TABLE, [
            Query.equal('isWorkspace', true),
            Query.equal('contextId', workspaceId),
            Query.limit(1),
        ]);
        if (legacy.rows?.length) return legacy.rows[0];
    } catch {
        /* non-fatal */
    }

    return null;
}
export const conversationRosterListeners = new Set<(rows: any[]) => void>();

export function invalidateConversationsListCache(userId?: string) {
    if (userId) {
        conversationsListCache.delete(userId);
        return;
    }
    conversationsListCache.clear();
}

export const arraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

export const canonicalizeParticipantsForMatch = (participants: string[]) =>
    Array.from(new Set((participants || []).filter(Boolean))).sort();

export const uniqueIds = (ids: Array<string | null | undefined>) =>
    Array.from(new Set(ids.map((value: any) => String(value || '').trim()).filter(Boolean)));

export const buildGroupAvatarUrl = (conversationId: string) => `${GROUP_AVATAR_ROUTE}?conversationId=${encodeURIComponent(conversationId)}`;

export const setConversationPreviewCache = (
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
        lastMessageSenderId: preview.lastMessageSenderId || null});
};

export const getConversationPreviewCache = (conversationId: string) => conversationPreviewCache.get(conversationId) || null;

export const emitConversationRosterCache = () => {
    const rows = Array.from(conversationRosterCache.values());
    conversationRosterListeners.forEach((listener) => {
        try {
            listener(rows);
        } catch (error) {
            console.warn('[ChatService] Conversation roster listener failed:', error);
        }
    });
};

export const rememberConversationRoster = (rows: any[]) => {
    conversationRosterCache.clear();
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (!row?.$id) continue;
            conversationRosterCache.set(row.$id, row);
        }
    }
    emitConversationRosterCache();
};


export const getConversationMemberSnapshot = async (conversationId: string, fallbackParticipants: string[] = []) => {
    const memberRows = await tablesDB.listRows(DB_ID, CONV_MEMBERS_TABLE, [
        Query.equal('conversationId', conversationId),
        Query.limit(1000)]).catch(() => ({ rows: [] as any[] }));

    const participants = uniqueIds([
        ...(memberRows.rows || []).map((row: any) => row.userId)]);

    if (participants.length > 0) {
        return participants;
    }

    return uniqueIds(fallbackParticipants);
};

export const getConversationActivityAt = (row: any) =>
    row?.lastMessageAt || row?.updatedAt || row?.createdAt || row?.$updatedAt || row?.$createdAt || null;

export const getMessageActivityAt = (row: any) =>
    row?.createdAt || row?.updatedAt || row?.$createdAt || row?.$updatedAt || null;

export async function notifyMessageStreak(conversation: any, senderId: string, conversationId: string) {
    const recipientIds = Array.isArray(conversation?.participants)
        ? uniqueIds(conversation.participants).filter((id) => id !== senderId)
        : [];

    if (recipientIds.length !== 1) return;

    const recentMessages = await tablesDB.listRows(DB_ID, MSG_TABLE, [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('createdAt'),
        Query.limit(5)]);

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

export const buildConversationMemberPermissions = (participantIds: string[], creatorId: string) => {
    const ids = Array.from(new Set([...(participantIds || []), creatorId].filter(Boolean)));
    return ids.map((id) => Permission.read(Role.user(id)));
};

export const normalizeConversationRow = async (conversation: any) => {
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

export const _getMessagePreview = async (message: any, conversationId: string) => {
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

export const buildLockboxMetadata = (payload: Record<string, unknown>) => JSON.stringify(payload);

type InviteMeta = Record<string, unknown> & {
    name?: string;
    description?: string;
};

export const parseInviteMeta = (value: unknown): InviteMeta | null => {
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

export const buildInviteMeta = (current: any, patch: Record<string, unknown>) => {
    const existing = parseInviteMeta(current?.inviteMeta) || {};
    const next: InviteMeta = {
        ...existing};

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

export async function getAuth(auth?: { jwt?: string; cookie?: string }) {
    if (auth?.jwt) return auth.jwt;
    try {
        const session = await account.createJWT().catch(() => null);
        return session?.jwt || null;
    } catch {
        return null;
    }
}

export async function callPermissionsApi(
    method: 'POST' | 'DELETE',
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await permissionsAction(method, { ...payload, jwt });
}

export async function callMessageCreateApi(
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await createMessageAction({
        conversationId: payload.conversationId as string,
        senderId: payload.senderId as string,
        content: payload.content as string,
        type: payload.type as string,
        attachments: payload.attachments as string[],
        replyTo: payload.replyTo as string,
        isBookmark: payload.isBookmark as boolean | undefined,
        jwt: jwt as any});
}

export async function callMessageReactionApi(
    method: 'POST' | 'DELETE',
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await toggleReactionAction({
        conversationId: payload.conversationId as string,
        messageId: payload.messageId as string,
        emoji: payload.emoji as string,
        action: method,
        jwt: jwt as any});
}

export async function callConversationRepairApi(
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await repairConversationAction({
        userId: payload.userId as string,
        conversationId: payload.conversationId as string,
        jwt: jwt as any});
}

export async function callJoinRequestApi(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    payload?: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await joinRequestServerAction({
        method,
        resourceType: payload?.resourceType as string || 'chat.conversation',
        resourceId: payload?.resourceId as string,
        requesterId: payload?.requesterId as string,
        action: payload?.action as 'accept' | 'reject',
        jwt: jwt as any});
}

export async function fetchKeyMapping(resourceType: string, resourceId: string, grantee: string) {
    try {
        const res = await tablesDB.listRows(KEY_MAPPING_DB, KEY_MAPPING_TABLE, [
            Query.equal('resourceType', resourceType),
            Query.equal('resourceId', resourceId),
            Query.equal('grantee', String(grantee || '').trim()),
            Query.limit(1)]).catch(() => ({ rows: [] as any[] }));

        if (res.rows && res.rows.length > 0) return res.rows[0];
    } catch (e) {
        console.warn('[ChatService] fetchKeyMapping lookup failed', e);
    }

    return null;
}

export async function fetchProfilePublicKey(userId: string) {
    try {
        const profile = await UsersService.getProfileById(userId);
        if (profile?.publicKey) return profile.publicKey;

        await UsersService.forceSyncProfileWithIdentity({ $id: userId }).catch(() => null);
        const refreshed = await UsersService.getProfileById(userId).catch(() => null);
        return refreshed?.publicKey || null;
    } catch {
        return null;
    }
}

export function isLikelyCiphertext(val: unknown): boolean {
    if (typeof val !== 'string' || !val.trim()) return false;
    const trimmed = val.trim();
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('ftp://') ||
        trimmed.startsWith('mailto:') ||
        trimmed.startsWith('nostr:') ||
        trimmed.startsWith('npub1') ||
        trimmed.startsWith('nsec1') ||
        trimmed.startsWith('note1')
    ) {
        return false;
    }
    if (
        trimmed.startsWith('{"iv"') ||
        trimmed.startsWith('{"data"') ||
        trimmed.startsWith('{"ct"') ||
        trimmed.startsWith('{"ciphertext"') ||
        trimmed.startsWith('[DECRYPTION_')
    ) {
        return true;
    }
    if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('?')) {
        return false;
    }
    return trimmed.length >= 32 && !trimmed.includes(' ') && /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
}

export async function unwrapKeyMapping(row: any, fallbackUserId?: string) {
    if (!row?.wrappedKey || !row?.grantee) return null;

    let metadata: Record<string, any> = {};
    try {
        metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
        metadata = {};
    }

    const candidates: string[] = [];
    const push = (v: unknown) => {
        if (typeof v === 'string' && v.trim() && !candidates.includes(v)) candidates.push(v);
    };

    push(metadata.senderPublicKey);
    push(metadata.wrappedByPublicKey);
    if (metadata.wrappedBy) {
        push(await fetchProfilePublicKey(metadata.wrappedBy));
    }
    if (fallbackUserId) {
        push(await fetchProfilePublicKey(fallbackUserId));
    }
    // Self-chat / same-device: prefer live identity pubkey over stale profile row
    try {
        push(await ecosystemSecurity.exportIdentityPublicKey());
    } catch {
        /* ignore */
    }

    for (const pub of candidates) {
        const key = await ecosystemSecurity.unwrapKeyWithECDHFlexible(row.wrappedKey, pub);
        if (key) return key;
    }
    return null;
}

export function conversationKeyLocalId(conversationId: string) {
    return `f_chat_conv_key_${conversationId}`;
}

export async function persistConversationKeyLocal(conversationId: string, key: CryptoKey) {
    if (!conversationId || !ecosystemSecurity.status.isUnlocked) return;
    try {
        const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
        let binary = '';
        raw.forEach((b) => {
            binary += String.fromCharCode(b);
        });
        const sealed = await ecosystemSecurity.encrypt(btoa(binary));
        await LocalEngine.cacheSet(conversationKeyLocalId(conversationId), sealed);
    } catch (error) {
        console.warn('[ChatService] Failed to persist conversation key locally:', error);
    }
}

export async function loadConversationKeyLocal(conversationId: string): Promise<CryptoKey | null> {
    if (!conversationId || !ecosystemSecurity.status.isUnlocked) return null;
    try {
        const sealed = await LocalEngine.cacheGet<string>(conversationKeyLocalId(conversationId));
        if (!sealed || typeof sealed !== 'string') return null;
        const b64 = await ecosystemSecurity.decrypt(sealed);
        const binary = atob(b64);
        const raw = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);
        return await crypto.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt'],
        );
    } catch {
        return null;
    }
}

export function cacheResolvedConversationKey(conversationId: string, key: CryptoKey) {
    conversationKeyCache.set(conversationId, key);
    ecosystemSecurity.setConversationKey(conversationId, key);
    void persistConversationKeyLocal(conversationId, key);
}

export async function fetchConversationKeyFromLockbox(conversationId: string, userId: string, creatorId?: string) {
    const row = await fetchKeyMapping('chat', conversationId, userId);
    if (!row) return null;
    return unwrapKeyMapping(row, creatorId || userId);
}

export async function fetchEpochKeyForConversation(conversationId: string, userId: string, messageCreatedAt?: string | null) {
    const epochsRes = await tablesDB.listRows(APPWRITE_CONFIG.DATABASES.CHAT, EPOCHS_TABLE, [
        Query.equal('resourceId', conversationId),
        Query.orderDesc('epochNumber'),
        Query.limit(50)]);

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

export async function resolveConversationKey(
    conversation: any,
    userId: string,
    messageCreatedAt?: string | null,
    auth?: { jwt?: string; cookie?: string },
    repairAttempted = false,
    options?: { allowCreate?: boolean },
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

    const cached = conversationKeyCache.get(conversation.$id) || ecosystemSecurity.getConversationKey(conversation.$id);
    if (cached && !messageCreatedAt) {
        return cached;
    }

    if (!messageCreatedAt) {
        const localKey = await loadConversationKeyLocal(conversation.$id);
        if (localKey) {
            conversationKeyCache.set(conversation.$id, localKey);
            ecosystemSecurity.setConversationKey(conversation.$id, localKey);
            return localKey;
        }
    }

    if (conversation.type === 'group' && String(conversation.encryptionVersion || '').toUpperCase() === 'T4') {
        const epochKey = await fetchEpochKeyForConversation(conversation.$id, userId, messageCreatedAt);
        if (epochKey) {
            if (!messageCreatedAt) {
                cacheResolvedConversationKey(conversation.$id, epochKey);
            }
            return epochKey;
        }
        // Fallback to direct chat mapping for base metadata decryption
    }

    const directKey = await fetchConversationKeyFromLockbox(conversation.$id, userId, conversation.creatorId || userId);
    if (directKey) {
        if (!messageCreatedAt) {
            cacheResolvedConversationKey(conversation.$id, directKey);
        }
        return directKey;
    }

    const isSelfChat = conversation.type === 'direct'
        && Array.isArray(conversation.participants)
        && conversation.participants.length > 0
        && conversation.participants.every((participantId: string) => participantId === userId);

    if (isSelfChat && ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
        try {
            await ecosystemSecurity.ensureE2EIdentity(userId);
            const retry = await fetchConversationKeyFromLockbox(conversation.$id, userId, userId);
            if (retry) {
                if (!messageCreatedAt) cacheResolvedConversationKey(conversation.$id, retry);
                return retry;
            }
        } catch (error) {
            console.warn('[ChatService] Self-chat lockbox retry failed:', error);
        }

        // Automatic Lockbox Seeding for self-chats: ensure self-chat keys are always initialized and persisted
        try {
            const publicKey = await ecosystemSecurity.ensureE2EIdentity(userId);
            if (publicKey) {
                const seededKey = await ecosystemSecurity.generateConversationKey();
                await syncLockboxRows([
                    {
                        resourceType: 'chat',
                        resourceId: conversation.$id,
                        grantee: userId,
                        wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(seededKey, publicKey),
                        metadata: buildLockboxMetadata({
                            wrappedBy: userId,
                            wrappedByPublicKey: publicKey,
                            senderPublicKey: publicKey,
                            conversationId: conversation.$id,
                            conversationType: 'direct',
                            version: 't4',
                            seededSelfChat: true,
                        }),
                    },
                ], auth).catch(() => null);
                cacheResolvedConversationKey(conversation.$id, seededKey);
                return seededKey;
            }
        } catch (seedErr) {
            console.warn('[ChatService] Failed to auto-seed missing self-chat key:', seedErr);
        }
    }

    if (!repairAttempted && !isSelfChat) {
        try {
          const repairResult = await callConversationRepairApi({
            userId,
            conversationId: conversation.$id}, auth);

          if (repairResult?.identity) {
            const repairedProfile = await UsersService.getProfileById(userId);
            seedIdentityCache(repairedProfile);
          }

          conversationKeyCache.delete(conversation.$id);
          ecosystemSecurity.clearConversationKey(conversation.$id);
          return await resolveConversationKey(conversation, userId, messageCreatedAt, auth, true, options);
        } catch (error) {
          console.warn('[ChatService] Conversation repair failed:', error);
        }
    }

    // Inbuilt Self-healing for direct chats where lockbox was never persisted (re-keying keyless chats is safe and resolves un-initialized conversations).
    // Uses system client via syncLockboxRows.
    if (
        options?.allowCreate &&
        !isSelfChat &&
        conversation.type === 'direct' &&
        ecosystemSecurity.status.isUnlocked &&
        ecosystemSecurity.status.hasIdentity
    ) {
        try {
            const participants = Array.isArray(conversation.participants) ? conversation.participants.filter(Boolean) as string[] : [];
            const unique = Array.from(new Set(participants.length ? participants : [userId]));
            const actorPub = await ecosystemSecurity.ensureE2EIdentity(userId);
            if (!actorPub) return null;
            const healedKey = await ecosystemSecurity.generateConversationKey();
            const healRows: LockboxEntry[] = await Promise.all(unique.map(async (pid) => {
                let pub = await fetchProfilePublicKey(pid);
                if (!pub || !isValidX25519PublicKey(pub)) {
                    // Force refresh identity from user profile
                    await UsersService.forceSyncProfileWithIdentity({ $id: pid }).catch(() => null);
                    pub = await fetchProfilePublicKey(pid);
                }
                if (!pub || !isValidX25519PublicKey(pub)) return null as any;
                return {
                    resourceType: 'chat',
                    resourceId: conversation.$id,
                    grantee: pid,
                    wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(healedKey, pub),
                    metadata: buildLockboxMetadata({
                        wrappedBy: userId,
                        senderPublicKey: actorPub,
                        wrappedByPublicKey: actorPub,
                        conversationId: conversation.$id,
                        conversationType: 'direct',
                        version: 't4',
                        healed: true,
                    }),
                };
            })).then((r) => r.filter(Boolean) as LockboxEntry[]);
            if (healRows.length === unique.length && healRows.length > 0) {
                await syncLockboxRows(healRows, auth);
                cacheResolvedConversationKey(conversation.$id, healedKey);
                return healedKey;
            }
        } catch (healErr) {
            console.warn('[ChatService] Direct chat self-heal failed:', healErr);
        }
    }

    return null;
}

export async function syncLockboxRows(entries: LockboxEntry[], auth?: { jwt?: string; cookie?: string }) {
    if (!entries.length) return [];
    return callPermissionsApi('POST', { action: 'grant', keyMappings: entries }, auth);
}

export async function syncConversationAccess(
    conversationId: string,
    participantIds: string[],
    permission: 'read' | 'write' = 'read',
    ownerId?: string,
    jwt?: string
) {
    const targets = Array.from(new Set(participantIds.filter(Boolean)));
    if (!conversationId || targets.length === 0) return;
    let _jwtSA = jwt;
    if (!_jwtSA) {
        try { const { account: _acc } = await import('../appwrite/client'); _jwtSA = await _acc.createJWT().then((r:any)=>r.jwt).catch(()=>undefined); } catch {}
    }
    return callPermissionsApi('POST', {
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: CONV_TABLE,
        rowId: conversationId,
        targetUserIds: targets,
        permission,
        ownerId,
        action: 'grant'}, _jwtSA ? { jwt: _jwtSA } as any : undefined);
}

export async function syncConversationAvatarAccess(
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
        action: 'grant'}, auth);
}

export async function revokeConversationAvatarAccess(
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
        action: 'revoke'}, auth);
}


export const chatServiceRef: { current: any } = { current: null };
