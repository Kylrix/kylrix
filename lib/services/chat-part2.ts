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
export const ChatServicePart2 = {
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
                throw new Error('Hangouts (groups) require a plan that includes group hangouts.');
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
