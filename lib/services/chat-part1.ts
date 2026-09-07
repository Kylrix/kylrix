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
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  DB_ID,
  CONV_TABLE,
  CONV_MEMBERS_TABLE,
  MSG_TABLE,
  EPOCHS_TABLE,
  KEY_MAPPING_DB,
  KEY_MAPPING_TABLE,
  GROUP_AVATAR_ROUTE,
  conversationKeyCache,
  conversationPreviewCache,
  conversationsListCache,
  CONVERSATIONS_LIST_TTL_MS,
  conversationRosterCache,
  workspaceConversationInflight,
  isUniqueConstraintError,
  findWorkspaceConversation,
  conversationRosterListeners,
  invalidateConversationsListCache,
  arraysEqual,
  canonicalizeParticipantsForMatch,
  uniqueIds,
  buildGroupAvatarUrl,
  setConversationPreviewCache,
  getConversationPreviewCache,
  emitConversationRosterCache,
  rememberConversationRoster,
  getConversationMemberSnapshot,
  getConversationActivityAt,
  getMessageActivityAt,
  notifyMessageStreak,
  buildConversationMemberPermissions,
  normalizeConversationRow,
  _getMessagePreview,
  buildLockboxMetadata,
  parseInviteMeta,
  buildInviteMeta,
  getAuth,
  callPermissionsApi,
  callMessageCreateApi,
  callMessageReactionApi,
  callConversationRepairApi,
  callJoinRequestApi,
  fetchKeyMapping,
  fetchProfilePublicKey,
  isLikelyCiphertext,
  unwrapKeyMapping,
  conversationKeyLocalId,
  persistConversationKeyLocal,
  loadConversationKeyLocal,
  cacheResolvedConversationKey,
  fetchConversationKeyFromLockbox,
  fetchEpochKeyForConversation,
  resolveConversationKey,
  syncLockboxRows,
  syncConversationAccess,
  syncConversationAvatarAccess,
  revokeConversationAvatarAccess
,
  chatServiceRef,
} from './chat-shared';
export const ChatServicePart1 = {
    async getConversationKey(convOrId: any, userId: string, messageCreatedAt?: string | null, options?: { allowCreate?: boolean }): Promise<CryptoKey | null> {
        let conv = typeof convOrId === 'string' ? { $id: convOrId } : convOrId;
        if ((!conv?.type || !conv?.participants) && conv?.$id) {
            try {
                const fullConv = await chatServiceRef.current.getConversationById(conv.$id, userId);
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
                throw new Error('Creating hangouts (groups) requires a plan that includes group hangouts.');
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
};
