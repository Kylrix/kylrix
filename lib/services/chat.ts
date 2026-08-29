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


const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const CONV_MEMBERS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS || 'conversationMembers';
const MSG_TABLE = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
const EPOCHS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.EPOCHS;
const KEY_MAPPING_DB = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
const KEY_MAPPING_TABLE = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING;
const GROUP_AVATAR_ROUTE = `${KYLRIX_AUTH_URI}/api/connect/group-avatar`;
const conversationKeyCache = new Map<string, CryptoKey>();
const conversationPreviewCache = new Map<string, {
    lastMessageId: string;
    lastMessageText: string;
    lastMessageAt: string;
    lastMessageSenderId?: string | null;
}>();
const conversationsListCache = new Map<string, { rows: any[]; fetchedAt: number; authoritative: boolean }>();
const CONVERSATIONS_LIST_TTL_MS = 5 * 60_000;

let conversationsFetchInflight: {
    userId: string;
    promise: Promise<{ total: number; rows: any[]; authoritative: boolean }>;
} | null = null;
const conversationRosterCache = new Map<string, any>();
const workspaceConversationInflight = new Map<string, Promise<any>>();

function isUniqueConstraintError(error: unknown): boolean {
    const err = error as { code?: number; message?: string; type?: string };
    const message = String(err?.message || err?.type || '').toLowerCase();
    return err?.code === 409 || message.includes('unique') || message.includes('duplicate') || message.includes('already exists');
}

async function findWorkspaceConversation(workspaceId: string) {
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
const conversationRosterListeners = new Set<(rows: any[]) => void>();

function invalidateConversationsListCache(userId?: string) {
    if (userId) {
        conversationsListCache.delete(userId);
        return;
    }
    conversationsListCache.clear();
}

const arraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const canonicalizeParticipantsForMatch = (participants: string[]) =>
    Array.from(new Set((participants || []).filter(Boolean))).sort();

const uniqueIds = (ids: Array<string | null | undefined>) =>
    Array.from(new Set(ids.map((value: any) => String(value || '').trim()).filter(Boolean)));

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
        lastMessageSenderId: preview.lastMessageSenderId || null});
};

const getConversationPreviewCache = (conversationId: string) => conversationPreviewCache.get(conversationId) || null;

const emitConversationRosterCache = () => {
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


const getConversationMemberSnapshot = async (conversationId: string, fallbackParticipants: string[] = []) => {
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

const buildConversationMemberPermissions = (participantIds: string[], creatorId: string) => {
    const ids = Array.from(new Set([...(participantIds || []), creatorId].filter(Boolean)));
    return ids.map((id) => Permission.read(Role.user(id)));
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

const _getMessagePreview = async (message: any, conversationId: string) => {
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

async function getAuth(auth?: { jwt?: string; cookie?: string }) {
    if (auth?.jwt) return auth.jwt;
    try {
        const session = await account.createJWT().catch(() => null);
        return session?.jwt || null;
    } catch {
        return null;
    }
}

async function callPermissionsApi(
    method: 'POST' | 'DELETE',
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await permissionsAction(method, { ...payload, jwt });
}

async function callMessageCreateApi(
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

async function callMessageReactionApi(
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

async function callConversationRepairApi(
    payload: Record<string, unknown>,
    auth?: { jwt?: string; cookie?: string }
) {
    const jwt = await getAuth(auth);
    return await repairConversationAction({
        userId: payload.userId as string,
        conversationId: payload.conversationId as string,
        jwt: jwt as any});
}

async function callJoinRequestApi(
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

async function fetchKeyMapping(resourceType: string, resourceId: string, grantee: string) {
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

async function fetchProfilePublicKey(userId: string) {
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

function isLikelyCiphertext(val: unknown): boolean {
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

async function unwrapKeyMapping(row: any, fallbackUserId?: string) {
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

function conversationKeyLocalId(conversationId: string) {
    return `f_chat_conv_key_${conversationId}`;
}

async function persistConversationKeyLocal(conversationId: string, key: CryptoKey) {
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

async function loadConversationKeyLocal(conversationId: string): Promise<CryptoKey | null> {
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

function cacheResolvedConversationKey(conversationId: string, key: CryptoKey) {
    conversationKeyCache.set(conversationId, key);
    ecosystemSecurity.setConversationKey(conversationId, key);
    void persistConversationKeyLocal(conversationId, key);
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

async function resolveConversationKey(
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

async function syncLockboxRows(entries: LockboxEntry[], auth?: { jwt?: string; cookie?: string }) {
    if (!entries.length) return [];
    return callPermissionsApi('POST', { action: 'grant', keyMappings: entries }, auth);
}

async function syncConversationAccess(
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
        action: 'grant'}, auth);
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
        action: 'revoke'}, auth);
}

export const ChatService = {
    async getConversationKey(convOrId: any, userId: string, messageCreatedAt?: string | null, options?: { allowCreate?: boolean }): Promise<CryptoKey | null> {
        let conv = typeof convOrId === 'string' ? { $id: convOrId } : convOrId;
        if ((!conv?.type || !conv?.participants) && conv?.$id) {
            try {
                const fullConv = await ChatService.getConversationById(conv.$id, userId);
                if (fullConv) conv = fullConv;
            } catch {}
        }
        return resolveConversationKey(conv, userId, messageCreatedAt, undefined, false, options);
    },

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

    invalidateConversationsListCache(userId?: string) {
        invalidateConversationsListCache(userId);
    },

    async rewrapConversationKeys(conversationId: string, auth?: { jwt?: string; cookie?: string }) {
        if (!conversationId) return null;
        const repairResult = await callConversationRepairApi({
            conversationId}, auth);

        conversationKeyCache.delete(conversationId);
        ecosystemSecurity.clearConversationKey(conversationId);
        return repairResult;
    },
    async getConversationById(conversationId: string, userId?: string) {
        const conv = await tablesDB.getRow(DB_ID, CONV_TABLE, conversationId).catch(() => null);
        if (!conv) return null as any;
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
                Query.limit(1000)]);

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
        if (!conv || !conv.isEncrypted || !ecosystemSecurity.status.isUnlocked) return conv;
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

        if (conv.name && isLikelyCiphertext(conv.name)) {
            try {
                conv.name = await ecosystemSecurity.decryptWithKey(conv.name, convKey);
            } catch (error) {
                console.warn('[ChatService] Failed to decrypt conversation name, keeping plaintext:', error);
            }
        }
        if (conv.lastMessageText && isLikelyCiphertext(conv.lastMessageText)) {
            try {
                conv.lastMessageText = await ecosystemSecurity.decryptWithKey(conv.lastMessageText, convKey);
            } catch (error) {
                console.warn('[ChatService] Failed to decrypt conversation preview, keeping plaintext:', error);
            }
        }
        return conv;
    },

    async getConversations(userId: string, options?: { forceRefresh?: boolean }) {
        // List rows are plaintext participants metadata — vault lock must NOT gate the list.
        // Empty is illegal (self-chat minimum per architecture.local-first/sync), so never return authoritative false empty when local exists.

        const cached = conversationsListCache.get(userId);
        if (
            cached &&
            !options?.forceRefresh &&
            Date.now() - cached.fetchedAt < CONVERSATIONS_LIST_TTL_MS
        ) {
            return {
                total: cached.rows.length,
                rows: cached.rows,
                authoritative: cached.authoritative,
            };
        }

        if (conversationsFetchInflight?.userId === userId && !options?.forceRefresh) {
            return conversationsFetchInflight.promise;
        }

        const promise = this._fetchConversations(userId).then((result) => {
            // Never cache a failed/non-authoritative empty result as truth.
            if (result.authoritative) {
                conversationsListCache.set(userId, {
                    rows: result.rows,
                    fetchedAt: Date.now(),
                    authoritative: true,
                });
            }
            return result;
        }).finally(() => {
            if (conversationsFetchInflight?.userId === userId) {
                conversationsFetchInflight = null;
            }
        });

        conversationsFetchInflight = { userId, promise };
        return promise;
    },

    async _fetchConversations(userId: string) {
        console.log('[ChatService] getConversations for:', userId);

        let conversationRows: any[] = [];
        let authoritative = false;

        try {
            const tokenRes = await account.createJWT().catch(() => null);
            const jwt = tokenRes?.jwt || undefined;
            const response = await getConversationsAction({ userId, jwt });
            conversationRows = response.rows || [];
            authoritative = true;
        } catch (err) {
            console.error('[ChatService] getConversationsAction failed:', err);
            // Fallback only if the participants query itself succeeds — never treat a failed query as empty.
            try {
                const legacy = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                    Query.contains('participants', userId),
                    Query.limit(100),
                ]);
                conversationRows = legacy.rows || [];
                authoritative = true;
            } catch (legacyErr) {
                console.error('[ChatService] Legacy conversations probe failed:', legacyErr);
                conversationRows = [];
                authoritative = false;
            }
        }

        const memberRowsByConversation = new Map<string, string[]>();
        for (const conv of conversationRows) {
            if (Array.isArray(conv.participants)) {
                memberRowsByConversation.set(conv.$id, conv.participants.filter(Boolean));
            }
        }

        const rows = conversationRows.map((conversation: any) => {
            const participants = memberRowsByConversation.get(conversation.$id) || conversation.participants || [];
            const normalizedConversation = {
                ...conversation,
                participants: Array.from(new Set((participants || []).filter(Boolean)))
            };
            const cachedPreview = getConversationPreviewCache(conversation.$id);
            const hydratedAt = new Date(getConversationActivityAt(normalizedConversation) || 0).getTime();
            const cachedAt = cachedPreview ? new Date(cachedPreview.lastMessageAt || 0).getTime() : -1;
            // List path: NEVER decrypt here — resolveConversationKey per row is what made Secure take minutes.
            // Names/avatars come from identity cache in ChatList; ciphertext previews stay until opened.
            if (cachedPreview && (cachedAt >= hydratedAt || !normalizedConversation.lastMessageText)) {
                return { ...normalizedConversation, ...cachedPreview };
            }
            return normalizedConversation;
        });

        rows.sort((a: any, b: any) => {
            const timeA = new Date(getConversationActivityAt(a) || 0).getTime();
            const timeB = new Date(getConversationActivityAt(b) || 0).getTime();
            return timeB - timeA;
        });

        // Dedupe direct chats by exact participant set + encryption flag (keep most recent) — preserves both plain text and E2EE chats between same pair
        const seenDirect = new Map<string, any>();
        const deduped: any[] = [];
        for (const row of rows) {
            if (row.type !== 'direct' || !Array.isArray(row.participants)) {
                deduped.push(row);
                continue;
            }
            const encFlag = !!row.isEncrypted ? 'enc' : 'plain';
            const key = `${canonicalizeParticipantsForMatch(row.participants).join('|')}:${encFlag}`;
            if (!seenDirect.has(key)) {
                seenDirect.set(key, row);
                deduped.push(row);
            }
        }

        return {
            total: deduped.length,
            rows: deduped,
            /** True only when a list query succeeded. Failed requests are not "empty". */
            authoritative,
        };
    },

    isSelfChatConversation(conversation: any, userId: string): boolean {
        if (!conversation || conversation.type !== 'direct') return false;
        const participants = Array.isArray(conversation.participants)
            ? conversation.participants.filter(Boolean)
            : [];
        if (participants.length !== 1 && participants.length !== 2) return false;
        return participants.every((p: string) => p === userId);
    },

    /**
     * Authoritative personal-chat probe.
     * `verified: true` means the DB query succeeded (found or confirmed absent).
     * `verified: false` means we could not tell — never create a self-chat in that case.
     */
    async findSelfConversation(userId: string): Promise<{
        conversation: any | null;
        verified: boolean;
        error?: unknown;
    }> {
        try {
            const res = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                Query.contains('participants', userId),
                Query.equal('type', 'direct'),
                Query.limit(100),
            ]);
            const found =
                (res.rows || []).find((c: any) => this.isSelfChatConversation(c, userId)) || null;
            return { conversation: found, verified: true };
        } catch (error) {
            console.warn('[ChatService] findSelfConversation probe failed:', error);
            return { conversation: null, verified: false, error };
        }
    },

    /**
     * Ensure personal chat exists — only creates after a successful not-found probe.
     */
    async ensureSelfConversation(userId: string): Promise<{
        conversation: any | null;
        created: boolean;
        skippedReason?: 'probe_failed' | 'exists';
    }> {
        const probe = await this.findSelfConversation(userId);
        if (!probe.verified) {
            return { conversation: null, created: false, skippedReason: 'probe_failed' };
        }
        if (probe.conversation) {
            return { conversation: probe.conversation, created: false, skippedReason: 'exists' };
        }

        // Listing is plaintext; opening secure material prompts unlock per WESP. Only ensure identity when unlocked.
        // While locked, explicitly request unencrypted self hangout (bookmarks) — never create secure hangout without transient vault key.
        if (ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity) {
            try { await ecosystemSecurity.ensureE2EIdentity(userId); } catch {}
        }
        try {
            const wantsEncrypted = ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity ? undefined : false;
            const created = await this.createConversation([userId], 'direct', undefined, wantsEncrypted !== undefined ? { encrypted: wantsEncrypted } as any : undefined);
            return { conversation: created, created: true };
        } catch {
            // Locked or not ready — fallback to local placeholder so list never empty (self-chat minimum)
            return {
                conversation: {
                    $id: `self-${userId}`,
                    $createdAt: new Date().toISOString(),
                    lastMessageAt: new Date().toISOString(),
                    type: 'direct',
                    participants: [userId],
                    isSelf: true,
                    name: 'You',
                    _placeholder: true,
                },
                created: false,
                skippedReason: undefined,
            };
        }
    },

    async getOrCreateWorkspaceConversation(workspaceId: string, workspaceTitle?: string, creatorId?: string) {
        if (!workspaceId) throw new Error('Workspace ID required');
        const user = creatorId ? { $id: creatorId } : await getCurrentUser();
        if (!user?.$id) throw new Error('User required');

        const inflight = workspaceConversationInflight.get(workspaceId);
        if (inflight) return inflight;

        const promise = (async () => {
            const existing = await findWorkspaceConversation(workspaceId);
            if (existing) return existing;

            const { createConversationTransactionalAction } = await import('@/lib/actions/chat');
            const tokenRes = await account.createJWT().catch(() => null);
            const jwt = tokenRes?.jwt || undefined;
            const convName = `${workspaceTitle || 'Workspace'} Discussion`;

            try {
                const newConv = await createConversationTransactionalAction({
                    participants: [user.$id],
                    type: 'group',
                    name: convName,
                    isEncrypted: false,
                    encryptionVersion: '1.0',
                    jwt,
                    isWorkspace: true,
                    contextType: 'workspace',
                    contextId: workspaceId,
                    isPublic: true,
                });
                rememberConversationRoster([newConv]);
                return newConv;
            } catch (err) {
                if (isUniqueConstraintError(err)) {
                    const retry = await findWorkspaceConversation(workspaceId);
                    if (retry) {
                        rememberConversationRoster([retry]);
                        return retry;
                    }
                }
                throw err;
            }
        })();

        workspaceConversationInflight.set(workspaceId, promise);
        try {
            return await promise;
        } finally {
            workspaceConversationInflight.delete(workspaceId);
        }
    },

    async createConversation(participants: string[], type: 'direct' | 'group' = 'direct', name?: string, opts?: { encrypted?: boolean }) {
        const creatorId = participants[0];
        const isSelf = type === 'direct' && participants.length === 1 && participants[0] === participants[participants.length - 1];
        const isSelfPlaceholder = isSelf;
        const wantEncrypted = opts?.encrypted !== undefined ? !!opts.encrypted : undefined; // undefined = auto (vault decides)

        if (!isSelfPlaceholder) {
            if (wantEncrypted === true) {
                if (!ecosystemSecurity.status.isUnlocked) throw new Error('Vault must be unlocked before creating encrypted conversations');
                if (!ecosystemSecurity.status.hasIdentity) throw new Error('E2E identity must be initialized before creating encrypted conversations');
            } else if (wantEncrypted === false) {
                // Unencrypted — no vault/identity needed, same tables, isEncrypted=false, no key_mapping
            } else {
                // Auto: legacy — require vault for direct/group unless self placeholder
                if (!ecosystemSecurity.status.isUnlocked) throw new Error('Vault must be unlocked before creating conversations');
                if (!ecosystemSecurity.status.hasIdentity) throw new Error('E2E identity must be initialized before creating conversations');
            }
        }
        const uniqueParticipants = isSelf ? [participants[0]] : Array.from(new Set(participants));
        const shouldEncrypt = wantEncrypted === true ? true : wantEncrypted === false ? false : (ecosystemSecurity.status.isUnlocked && ecosystemSecurity.status.hasIdentity);
        // Secure hangouts (isEncrypted=true) require unlocked vault for any participant set, including self — transient session gate per WESP.
        if (shouldEncrypt) {
            if (!ecosystemSecurity.status.isUnlocked) throw new Error('Vault must be unlocked before creating secure hangouts');
            if (!ecosystemSecurity.status.hasIdentity) throw new Error('E2E identity must be initialized before creating secure hangouts');
        }

        // Personal chat: only proceed when a successful probe says it does not exist.
        if (isSelf) {
            const probe = await this.findSelfConversation(creatorId);
            if (!probe.verified) {
                throw new Error('Could not verify personal chat status. Try again.');
            }
            if (probe.conversation) {
                // If encrypted flag differs, allow creating opposite type (self can have both encrypted + unencrypted/bookmarks)
                if (wantEncrypted !== undefined) {
                    const existingEncrypted = !!(probe.conversation as any).isEncrypted;
                    if (existingEncrypted !== shouldEncrypt) {
                        // Need to check if opposite-type self chat already exists separately
                        try {
                            const all = await tablesDB.listRows(DB_ID, CONV_TABLE, [
                                Query.contains('participants', creatorId),
                                Query.equal('type', 'direct'),
                                Query.limit(100),
                            ]);
                            const matchOpposite = (all.rows || []).find((c: any) => this.isSelfChatConversation(c, creatorId) && !!(c as any).isEncrypted === shouldEncrypt);
                            if (matchOpposite) {
                                console.log('[ChatService] Self chat opposite type already exists:', matchOpposite.$id);
                                return matchOpposite;
                            }
                        } catch {}
                        // No opposite-type self chat yet — fall through to create
                    } else {
                        console.log('[ChatService] Personal chat already exists:', probe.conversation.$id);
                        return probe.conversation;
                    }
                } else {
                    console.log('[ChatService] Personal chat already exists:', probe.conversation.$id);
                    return probe.conversation;
                }
            }
        }

        // GUARD: Enforce hangout (groups) limits based on tier
        if (type === 'group') {
            const currentUser = await getCurrentUser();
            const userTier = getUserSubscriptionTier(currentUser);
            if (!allowsGroupHangouts(userTier)) {
                throw new Error('Creating hangouts (groups) is a TEAMS feature. Use resource discussions for collaboration, or upgrade to TEAMS for group chats.');
            }
        }

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
                        const memberSet = participantsByConversation.get(conversation.$id);
                        const rawParticipants = memberSet && memberSet.length ? memberSet : (Array.isArray((conversation as any).participants) ? (conversation as any).participants : []);
                        const existingParticipantSet = canonicalizeParticipantsForMatch(rawParticipants);

                        if (arraysEqual(existingParticipantSet, targetParticipantSet)) {
                            // Respect isEncrypted distinction — allow both encrypted and unencrypted directs between same pair
                            if (wantEncrypted !== undefined) {
                                const existingEncrypted = !!(conversation as any).isEncrypted;
                                if (existingEncrypted !== shouldEncrypt) continue;
                            }
                            console.log('[ChatService] Direct chat already exists, returning existing:', conversation.$id);
                            return conversation;
                        }
                    }
                }
            }
        }

        let convKey: CryptoKey | null = null;
        if (shouldEncrypt) {
            convKey = await ecosystemSecurity.generateConversationKey();
        }

        let encryptedName = name;
        if (name && convKey && shouldEncrypt) {
            encryptedName = await ecosystemSecurity.encryptWithKey(name, convKey);
        }

        // TRANSACTIONAL: Stage conversation + members + key_mappings (+ epoch) atomically via system Transactions API.
        // Modular withSystemTransaction ensures all-or-nothing; if any stage fails, entire transaction rolls back.
        const { account: _chatAccount } = await import('../appwrite/client');
        const _jwt = await _chatAccount.createJWT().then((r: any) => r.jwt).catch(() => undefined);
        let lockboxRows: Array<{ resourceType: string; grantee: string; wrappedKey: string; metadata?: string }> = [];
        if (convKey) {
            try {
                const creatorPublicKey = ecosystemSecurity.status.hasIdentity ? await ecosystemSecurity.ensureE2EIdentity(creatorId) : null;
                if (!creatorPublicKey) throw new Error('E2E identity not available for lockbox wrapping');
                lockboxRows = await Promise.all(uniqueParticipants.map(async (pid) => {
                    const livePub = await fetchProfilePublicKey(pid);
                    if (!livePub) throw new Error(`${pid} hasn't finished secure chat setup yet.`);
                    if (!isValidX25519PublicKey(livePub)) throw new Error(`Invalid public key for user ${pid}`);
                    return { resourceType: 'chat', grantee: pid, wrappedKey: await ecosystemSecurity.wrapKeyWithECDH(convKey as CryptoKey, livePub), metadata: buildLockboxMetadata({ wrappedBy: creatorId, senderPublicKey: creatorPublicKey!, wrappedByPublicKey: creatorPublicKey!, conversationId: 'pending', conversationType: type, version: 't4' }) };
                }));
            } catch (e) {
                // If wrapping fails, abort before transaction — no partial conversation
                throw e;
            }
        }

        const { createConversationTransactionalAction } = await import('@/lib/actions/chat');
        const newConv = await createConversationTransactionalAction({
            participants: uniqueParticipants,
            type,
            name: encryptedName || 'Direct Chat',
            isEncrypted: shouldEncrypt && !!convKey,
            encryptionVersion: shouldEncrypt && convKey ? 'T4' : '1.0',
            lockboxRows: shouldEncrypt ? lockboxRows : [],
            jwt: _jwt,
        }) as any;

        // Cache the local key — transactional withSystemTransaction already staged conversation+members+key_mappings atomically.
        if (convKey) {
            cacheResolvedConversationKey(newConv.$id, convKey);
            // Transactional path already persisted lockboxRows/epochRows; no separate sync needed — atomic commit ensures all-or-nothing.
            try {
                const recipientIds = uniqueParticipants.filter((id) => id !== creatorId);
                if (recipientIds.length > 0) {
                    // Create a fresh JWT — the one used for the transactional action may be expired/consumed
                    let _syncJwt = _jwt;
                    try { const { account: _accSync } = await import('../appwrite/client'); _syncJwt = await _accSync.createJWT().then((r: any) => r.jwt).catch(() => _jwt); } catch {}
                    await syncConversationAccess(
                        newConv.$id,
                        recipientIds,
                        type === 'direct' ? 'write' : 'read',
                        creatorId,
                        _syncJwt
                    );
                }
            } catch (lockboxErr) {
                console.error('[ChatService] Failed to persist lockbox rows:', lockboxErr);
                // Do not swallow for non-self chats — surface to caller so UI can retry instead of leaving broken conversation
                if (!isSelf) throw lockboxErr;
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
        permissionSyncAuth?: { jwt?: string; cookie?: string },
        options?: { isBookmark?: boolean },
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

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const participants = Array.isArray(conversation.participants)
            ? conversation.participants.filter(Boolean)
            : [];
        if (participants.length && !participants.includes(senderId)) {
            throw new Error('You are not a participant in this conversation');
        }

        // Treat single-user / duplicate-self participant rows as self-chat for key seeding
        const looksSelf =
            conversation.type === 'direct' &&
            participants.length > 0 &&
            participants.every((p: string) => p === senderId);
        if (looksSelf && !participants.includes(senderId)) {
            conversation = { ...conversation, participants: [senderId, senderId] };
        } else if (looksSelf) {
            conversation = { ...conversation, participants };
        }

        if ((type === 'text' || type === 'attachment') && conversation?.isEncrypted && ecosystemSecurity.status.isUnlocked) {
            let convKey = await resolveConversationKey(conversation, senderId, null, permissionSyncAuth, false, {
                allowCreate: true,
            });
            // Last resort for encrypted DMs we own: seed key so send isn't bricked
            if (!convKey && conversation.creatorId === senderId && conversation.type === 'direct') {
                convKey = await resolveConversationKey(
                    { ...conversation, participants: participants.length ? participants : [senderId, senderId] },
                    senderId,
                    null,
                    permissionSyncAuth,
                    false,
                    { allowCreate: true },
                );
            }
            if (!convKey) throw new Error('Conversation key not available');
            finalContent = await ecosystemSecurity.encryptWithKey(content, convKey);
            cacheResolvedConversationKey(conversationId, convKey);
        }

        const message = await callMessageCreateApi({
            conversationId,
            senderId,
            content: finalContent,
            type,
            attachments,
            replyTo,
            isBookmark: options?.isBookmark,
        }, permissionSyncAuth);

        if (type === 'text') {
            notifyMessageStreak(conversation, senderId, conversationId).catch((error: any) => {
                console.error('[ChatService] Failed to queue message streak email', error);
            });
        }

        // 2. Best-effort conversation preview update via secure-ops (read-only client rule).
        if (conversation?.creatorId === senderId) {
            try {
                const now = new Date().toISOString();
                let _jwtPreview = permissionSyncAuth?.jwt;
                if (!_jwtPreview) { try { const { account: _accPrev } = await import('../appwrite/client'); _jwtPreview = await _accPrev.createJWT().then((r:any)=>r.jwt).catch(()=>undefined); } catch {} }
                const { updateRowSecure: _upd } = await import('@/lib/actions/secure-ops');
                await _upd(DB_ID, CONV_TABLE, conversationId, {
                    lastMessageId: message.$id,
                    lastMessageAt: now,
                    lastMessageText: type === 'text' ? finalContent : `[${type}]`,
                } as any, undefined, _jwtPreview);
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
        invalidateConversationsListCache(senderId);

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
            emoji}, permissionSyncAuth);
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
            emoji}, permissionSyncAuth);
    },

    async getMessages(conversationId: string, limit = 50, offset = 0, userId?: string, options?: { prefetchedConversation?: any }) {
        console.log('[ChatService] getMessages for:', conversationId, 'limit:', limit);
        // Parallelize message list fetch and conversation/key resolution for maximum speed
        let _conv = options?.prefetchedConversation;
        const convPromise = _conv
            ? Promise.resolve(_conv)
            : (userId ? this.getConversationById(conversationId, userId).catch(() => null) : Promise.resolve(null));

        const keyPromise = convPromise.then(async (c) => {
            if (userId && c) return await resolveConversationKey(c, userId);
            return conversationKeyCache.get(conversationId) || ecosystemSecurity.getConversationKey(conversationId);
        });

        const listPromise = tablesDB.listRows(DB_ID, MSG_TABLE, [
            Query.equal('conversationId', conversationId),
            Query.orderDesc('createdAt'),
            Query.limit(limit),
            Query.offset(offset)
        ]);

        try {
            const [res, convKey, resolvedConv] = await Promise.all([
                listPromise,
                keyPromise,
                convPromise
            ]);
            _conv = resolvedConv || _conv;

            console.log('[ChatService] listRows returned:', res.total, 'rows:', res.rows.length);

            // Snapshot ciphertext before decrypt — safe for LocalEngine at-rest cache
            const atRestRows = res.rows.map((msg: any) => ({ ...msg }));

            // Decrypt messages in parallel
            res.rows = await Promise.all(res.rows.map(async (msg: any) => {
                const isEncrypted = ecosystemSecurity.status.isUnlocked && (
                    (msg.type === 'text' && msg.content && isLikelyCiphertext(msg.content)) ||
                    isLikelyCiphertext(msg.metadata)
                );

                if (isEncrypted) {
                    try {
                        let messageKey = _conv?.type === 'group' && String(_conv?.encryptionVersion || '').toUpperCase() === 'T4' && userId
                            ? await resolveConversationKey(_conv, userId, msg.createdAt)
                            : convKey;
                        
                        if (!messageKey && userId) {
                            messageKey = _conv?.type === 'group' && String(_conv?.encryptionVersion || '').toUpperCase() === 'T4'
                                ? await resolveConversationKey(_conv, userId, msg.createdAt)
                                : await resolveConversationKey(_conv, userId);
                        }

                        if (!messageKey) return msg;

                        if (msg.type === 'text' && msg.content && isLikelyCiphertext(msg.content)) {
                            msg.content = await ecosystemSecurity.decryptWithKey(msg.content, messageKey);
                        }
                        if (msg.metadata && isLikelyCiphertext(msg.metadata)) {
                            const decryptedMeta = await ecosystemSecurity.decryptWithKey(msg.metadata, messageKey);
                            try {
                                msg.metadata = JSON.parse(decryptedMeta);
                            } catch {
                                msg.metadata = decryptedMeta;
                            }
                        }
                    } catch (err) {
                        console.warn('[ChatService] Failed to decrypt message:', msg.$id, err);
                        // Keep encrypted content as fallback
                    }
                }
                return msg;
            }));

            if (res.rows.length > 0) {
                const latestMessage = res.rows[0];
                setConversationPreviewCache(conversationId, {
                    lastMessageId: latestMessage.$id,
                    lastMessageText: latestMessage.type === 'text' || latestMessage.type === 'attachment'
                        ? String(latestMessage.content || '')
                        : `[${latestMessage.type || 'message'}]`,
                    lastMessageAt: getMessageActivityAt(latestMessage) || latestMessage.$createdAt || latestMessage.$updatedAt || new Date().toISOString(),
                    lastMessageSenderId: latestMessage.senderId || null,
                });
            }

            return Object.assign(res, { atRestRows });
        } catch (error: any) {
            console.error('[ChatService] getMessages failed:', error);
            throw error;
        }
    },

    /** Decrypt ciphertext message rows (e.g. LocalEngine hydrate). Mutates copies. */
    async decryptMessageRows(rows: any[], conversation: any, userId?: string) {
        if (!rows?.length) return rows || [];
        if (!ecosystemSecurity.status.isUnlocked) return rows.map((m) => ({ ...m }));

        const convKey = userId
            ? await resolveConversationKey(conversation, userId)
            : conversationKeyCache.get(conversation?.$id || conversation?.id) ||
              ecosystemSecurity.getConversationKey(conversation?.$id || conversation?.id);

        return Promise.all(
            rows.map(async (raw: any) => {
                const msg = { ...raw };
                const needsDecrypt =
                    (msg.type === 'text' && msg.content && isLikelyCiphertext(msg.content)) ||
                    isLikelyCiphertext(msg.metadata);
                if (!needsDecrypt) return msg;

                try {
                    let messageKey =
                        conversation?.type === 'group' &&
                        String(conversation?.encryptionVersion || '').toUpperCase() === 'T4' &&
                        userId
                            ? await resolveConversationKey(conversation, userId, msg.createdAt)
                            : convKey;

                    if (!messageKey && userId) {
                        messageKey = await resolveConversationKey(conversation, userId);
                    }
                    if (!messageKey) return msg;

                    if (msg.type === 'text' && msg.content && isLikelyCiphertext(msg.content)) {
                        msg.content = await ecosystemSecurity.decryptWithKey(msg.content, messageKey);
                    }
                    if (msg.metadata && isLikelyCiphertext(msg.metadata)) {
                        const decryptedMeta = await ecosystemSecurity.decryptWithKey(msg.metadata, messageKey);
                        try {
                            msg.metadata = JSON.parse(decryptedMeta);
                        } catch {
                            msg.metadata = decryptedMeta;
                        }
                    }
                } catch (err) {
                    console.warn('[ChatService] decryptMessageRows failed:', msg.$id, err);
                }
                return msg;
            }),
        );
    },

    /**
     * Wipes all messages authored by the user in this conversation.
     * Also removes reactions they authored and reactions attached to their messages.
     */
    async wipeMyFootprint(conversationId: string, userId: string) {
        console.log(`[ChatService] Wiping footprint for ${userId} in ${conversationId}`);
        const jwt = await getAuth();
        const res = await clearConversationFootprintAction({ conversationId, jwt: jwt as any });
        this.clearConversationPreviewCache(conversationId);
        conversationKeyCache.delete(conversationId);
        return { success: true, count: res?.messagesDeleted || 0, reactionsDeleted: res?.reactionsDeleted || 0 };
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

        const jwt = await getAuth();
        return await clearChatForMeAction({ conversationId, encryptedSettings, jwt: jwt as any });
    },

    /**
     * Entirely deletes all messages in a conversation (Reserved for Saved Messages/Self-Chat)
     */
    async nuclearWipe(conversationId: string) {
        const jwt = await getAuth();
        const res = await nuclearWipeConversationAction({ conversationId, jwt: jwt as any });
        this.clearConversationPreviewCache(conversationId);
        conversationKeyCache.delete(conversationId);
        const { success: _ignoredSuccess, ...rest } = res || {};
        return { ...rest, success: true };
    },

    async deleteConversationFully(conversationId: string) {
        const conversation = await this.getConversationById(conversationId).catch(() => null);
        const jwt = await getAuth();
        const res = await deleteConversationFullyAction({ conversationId, jwt: jwt as any });
        this.clearConversationPreviewCache(conversationId);
        conversationKeyCache.delete(conversationId);
        const { success: _ignoredSuccess2, ...rest } = res || {};
        return { ...rest, success: true, conversation };
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

        const jwt = await getAuth();
        return await updateConversationAction({ conversationId, data: patch, jwt: jwt as any });
    },

    async addParticipant(conversationId: string, userId: string) {
        const conv = await this.getConversationById(conversationId);
        const participants = conv.participants || [];

        // GUARD: Enforce hangouts (groups) are Teams-only
        if (conv.type === 'group') {
            const currentUser = await getCurrentUser();
            const userTier = getUserSubscriptionTier(currentUser);
            if (!allowsGroupHangouts(userTier)) {
                throw new Error('Hangouts (groups) are a TEAMS feature. Use resource discussions for collaboration, or upgrade to TEAMS.');
            }
        }
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
                const { account: _accInvite } = await import('../appwrite/client');
                const _jwtInvite = await _accInvite.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);
                const { createRowSecure: _createRowSecureInvite } = await import('@/lib/actions/secure-ops');
                const memberRow = await _createRowSecureInvite(DB_ID, CONV_MEMBERS_TABLE, {
                    $id: ID.unique(),
                    conversationId,
                    userId
                } as any, buildConversationMemberPermissions([...participants, userId], conv.creatorId || participants[0] || userId), _jwtInvite).catch(() => null) as any;

                if (memberRow?.$id) {
                    await callPermissionsApi('POST', {
                        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
                        tableId: CONV_MEMBERS_TABLE,
                        rowId: memberRow.$id,
                        ownerId: conv.creatorId || participants[0] || userId,
                        targetUserIds: [...participants, userId],
                        permission: 'read',
                        action: 'grant',
                        jwt: _jwtInvite} as any);
                }
            }

            const updatedParticipants = await getConversationMemberSnapshot(conversationId, [...participants, userId]);
            const updated = await this.updateConversation(conversationId, {
                participants: updatedParticipants});
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
                    Query.limit(1)]).catch(() => ({ rows: [] as any[] }));
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
                            rotation: 'member-added'}),
                    });
                }

                const _jwtRewrap = await (async () => { try { const { account: _a } = await import('../appwrite/client'); return await _a.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);} catch { return undefined; } })();
                await callPermissionsApi('POST', {
                    action: 'rotate_epoch',
                    resourceId: conversationId,
                    ownerId: conv.creatorId || participants[0] || userId,
                    participantUserIds: updatedParticipants,
                    epochNumber: nextEpochNumber,
                    keyMappings,
                    jwt: _jwtRewrap} as any);

                // Also sync base 'chat' lockbox rows for the newly added participant/everyone
                // This ensures conversation metadata (name/preview) remains decryptable
                if (keyMappings.length > 0) {
                    await syncLockboxRows(keyMappings.map(entry => ({
                        ...entry,
                        resourceType: 'chat',
                        resourceId: conversationId
                    })), { jwt: _jwtRewrap } as any);
                }
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
            const { account: _accLeave } = await import('../appwrite/client');
            const _jwtLeave = await _accLeave.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);
            const { deleteRowSecure: _delMember } = await import('@/lib/actions/secure-ops');
            await _delMember(DB_ID, CONV_MEMBERS_TABLE, memberRows.rows[0].$id, _jwtLeave).catch(() => null);
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
            resourceId: conversationId});

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
                            rotation: 'member-removal'}),
                    });
                }

                if (keyMappings.length > 0) {
                    await callPermissionsApi('POST', {
                        action: 'rotate_epoch',
                        resourceId: conversationId,
                        participantUserIds: participants,
                        keyMappings});
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
            Query.limit(1000)]);

        return rows;
    },

    async updateConversationInvite(conversationId: string, enabled: boolean) {
        return await this.updateConversation(conversationId, {
            inviteLink: enabled ? conversationId : null,
            inviteLinkExpiry: null});
    },

    async updateConversationAvatar(conversationId: string, file: File, auth?: { jwt?: string; cookie?: string }) {
        const current = await this.getConversationById(conversationId);
        const existingParticipants = uniqueIds([
            ...(Array.isArray(current?.participants) ? current.participants : []),
            current?.creatorId,
            ...(Array.isArray(current?.admins) ? current.admins : [])]);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucketId', APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS);
        const { secureUploadFile } = await import('@/lib/actions/client-ops');
        const uploaded = await secureUploadFile(formData);
        try {
            await syncConversationAvatarAccess(uploaded.$id, existingParticipants, auth);
            return await this.updateConversation(conversationId, {
                avatarFileId: uploaded.$id,
                avatarUrl: buildGroupAvatarUrl(conversationId)});
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
            action});
    },

    async cancelJoinRequest(resourceType: string, resourceId: string) {
        return callJoinRequestApi('DELETE', {
            resourceType,
            resourceId});
    },

    async deleteMessage(messageId: string) {
        const { account: _accDel } = await import('../appwrite/client');
        const _jwtDel = await _accDel.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);
        const { deleteRowSecure: _delMsg } = await import('@/lib/actions/secure-ops');
        return await _delMsg(DB_ID, MSG_TABLE, messageId, _jwtDel);
    },

    async updateMessage(messageId: string, data: Partial<{ content: string; type: string; readBy: string[] }>) {
        const { account: _accUpd } = await import('../appwrite/client');
        const _jwtUpd = await _accUpd.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);
        const { updateRowSecure: _updMsg } = await import('@/lib/actions/secure-ops');
        return await _updMsg(DB_ID, MSG_TABLE, messageId, {
            ...data
        } as any, undefined, _jwtUpd);
    },

    async markAsRead(messageId: string, userId: string) {
        try {
            const message = await tablesDB.getRow(DB_ID, MSG_TABLE, messageId);
            const readBy = message.readBy || [];
            if (!readBy.includes(userId)) {
                const { account: _accRead } = await import('../appwrite/client');
                const _jwtRead = await _accRead.createJWT().then((r:any)=>r.jwt).catch(()=>undefined);
                const { updateRowSecure: _updRead } = await import('@/lib/actions/secure-ops');
                return await _updRead(DB_ID, MSG_TABLE, messageId, {
                    readBy: [...readBy, userId]
                } as any, undefined, _jwtRead);
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
