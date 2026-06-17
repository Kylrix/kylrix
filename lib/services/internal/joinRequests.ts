import { ID, Permission, Query, Role } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { mutateStorageFilePermissions } from '@/lib/api/permission-updater';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const CONVERSATION_MEMBERS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS;
const JOIN_REQUESTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS;

const normalizeText = (input: unknown) => (typeof input === 'string' ? input.trim() : '');
const uniqueIds = (ids: Array<string | null | undefined>) => Array.from(new Set(ids.map((value) => normalizeText(value)).filter(Boolean)));

function normalizeResourceType(input: unknown) {
  const value = normalizeText(input).toLowerCase();
  if (['chat', 'chat.conversation', 'chat:conversation', 'chat-conversation', 'group', 'groups'].includes(value)) return 'chat.conversation';
  return value;
}

function hashJoinRequestId(resourceType: string, resourceId: string, requesterId: string) {
  return createHash('sha256').update(`${resourceType}:${resourceId}:${requesterId}`).digest('base64url').slice(0, 32);
}

function getConversationInviteEnabled(conversation: any) {
  const inviteToken = normalizeText(conversation?.inviteLink);
  if (!inviteToken) {
    console.warn('[getConversationInviteEnabled] No inviteToken found in conversation object');
    return false;
  }
  
  const expiryRaw = conversation?.inviteLinkExpiry;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
        console.warn('[getConversationInviteEnabled] Invite link expired for:', conversation.$id, 'Expiry:', expiryRaw);
        return false;
    }
  }

  const conversationId = conversation?.$id || conversation?.id;
  const isMatch = inviteToken === conversationId;
  
  console.log('[getConversationInviteEnabled] Validation:', {
    inviteToken,
    tokenType: typeof inviteToken,
    tokenLength: inviteToken.length,
    conversationId,
    idType: typeof conversationId,
    idLength: conversationId?.length,
    isMatch
  });

  if (!isMatch) {
    console.warn('[getConversationInviteEnabled] Token mismatch detected.');
  }

  return isMatch;
}

function getManagers(conversation: any) {
  return uniqueIds([conversation?.creatorId, ...(Array.isArray(conversation?.admins) ? conversation.admins : [])]);
}

function buildRequestPermissions(requesterId: string, managers: string[]) {
  return [
    Permission.read(Role.user(requesterId)),
    ...managers.map((managerId) => Permission.read(Role.user(managerId)))];
}

async function getConversation(databases: ReturnType<typeof createSystemClient>['databases'], conversationId: string) {
  return databases.getRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, conversationId);
}

async function getJoinRequest(databases: ReturnType<typeof createSystemClient>['databases'], resourceType: string, resourceId: string, requesterId: string) {
  const existing = await databases.listRows(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
    Query.equal('resourceType', resourceType),
    Query.equal('resourceId', resourceId),
    Query.equal('requesterId', requesterId),
    Query.limit(1)]);
  return existing.rows[0] || null;
}

async function isConversationMember(databases: ReturnType<typeof createSystemClient>['databases'], conversation: any, userId: string) {
  if (!userId) return false;
  if (Array.isArray(conversation?.participants) && uniqueIds(conversation.participants).includes(userId)) return true;
  const memberRows = await databases.listRows(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
    Query.equal('conversationId', conversation.$id),
    Query.equal('userId', userId),
    Query.limit(1)]).catch(() => ({ rows: [] as any[], rows: [] as any[] }));
  return Boolean(memberRows.rows[0]);
}

export async function loadJoinRequestPreview(input: { resourceType: string; resourceId: string; requesterId?: string }) {
  console.log('[loadJoinRequestPreview] Start:', input);
  const { databases } = createSystemClient();
  const resourceType = normalizeResourceType(input.resourceType);
  const resourceId = normalizeText(input.resourceId);
  const requesterId = normalizeText(input.requesterId);
  
  try {
    const conversation = await getConversation(databases, resourceId);
    console.log('[loadJoinRequestPreview] Conversation found:', conversation.$id, 'inviteLink:', conversation.inviteLink);
    
    if (!getConversationInviteEnabled(conversation)) {
        console.warn('[loadJoinRequestPreview] Invite link disabled or mismatched for:', resourceId);
        throw new Error('Group does not exist');
    }
    
    const alreadyJoined = requesterId ? await isConversationMember(databases, conversation, requesterId) : false;
    const request = requesterId ? await getJoinRequest(databases, resourceType, resourceId, requesterId) : null;
    
    console.log('[loadJoinRequestPreview] Success:', { alreadyJoined, requestId: request?.$id });
    return { conversation, alreadyJoined, request };
  } catch (error: any) {
    console.error('[loadJoinRequestPreview] Failed:', error?.message);
    throw error;
  }
}

export async function createJoinRequest(input: { userId: string; resourceType: string; resourceId: string }) {
  const { databases } = createSystemClient();
  const resourceType = normalizeResourceType(input.resourceType);
  const resourceId = normalizeText(input.resourceId);
  const conversation = await getConversation(databases, resourceId);
  if (!getConversationInviteEnabled(conversation)) throw new Error('Group does not exist');
  if (await isConversationMember(databases, conversation, input.userId)) return { alreadyJoined: true, request: null, conversation };
  const existing = await getJoinRequest(databases, resourceType, resourceId, input.userId);
  if (existing) return { alreadyJoined: false, request: existing, conversation };
  const managers = getManagers(conversation);
  const requestId = hashJoinRequestId(resourceType, resourceId, input.userId);
  const request = await databases.createRow(
    CHAT_DB_ID,
    JOIN_REQUESTS_TABLE_ID,
    requestId,
    { resourceType, resourceId, requesterId: input.userId, status: 'pending', createdAt: new Date().toISOString() },
    buildRequestPermissions(input.userId, managers),
  );
  return { alreadyJoined: false, request, conversation };
}

export async function resolveJoinRequest(input: {
  actorId: string;
  actorName?: string;
  resourceType: string;
  resourceId: string;
  requesterId: string;
  action: 'accept' | 'reject';
}) {
  const { databases, storage } = createSystemClient();
  const resourceType = normalizeResourceType(input.resourceType);
  const conversation = await getConversation(databases, input.resourceId);
  const managers = getManagers(conversation);
  if (!managers.includes(input.actorId)) throw new Error('Forbidden');
  const request = await getJoinRequest(databases, resourceType, input.resourceId, input.requesterId);
  if (!request) throw new Error('Join request not found');
  const updated = await databases.updateRow(
    CHAT_DB_ID,
    JOIN_REQUESTS_TABLE_ID,
    request.$id,
    { status: input.action === 'accept' ? 'accepted' : 'rejected', resolvedAt: new Date().toISOString(), resolvedBy: input.actorId },
    buildRequestPermissions(input.requesterId, managers),
  );
  if (input.action === 'accept') {
    const participants = uniqueIds([...(Array.isArray(conversation?.participants) ? conversation.participants : []), input.requesterId]);
    const permissions = [
      Permission.read(Role.user(conversation.creatorId)),
      ...participants.flatMap((participantId) => [Permission.read(Role.user(participantId))]),
      ...managers.map((managerId) => Permission.read(Role.user(managerId)))];
    await Promise.all([
      databases.updateRow(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, conversation.$id, { participants, participantCount: participants.length, updatedAt: new Date().toISOString() }, permissions),
      databases.createRow(
        CHAT_DB_ID,
        CONVERSATION_MEMBERS_TABLE_ID,
        ID.unique(),
        { conversationId: conversation.$id, userId: input.requesterId },
        [Permission.read(Role.user(input.requesterId)), ...managers.map((managerId) => Permission.read(Role.user(managerId)))],
      ).catch((error: any) => {
        if (error?.code !== 409) throw error;
        return null;
      })]);
    if (conversation?.avatarFileId) {
      await mutateStorageFilePermissions(storage, input.actorId, {
        bucketId: APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS,
        fileId: conversation.avatarFileId,
        targetUserIds: [input.requesterId],
        permission: 'read',
      });
    }
    await dispatchEmail({
      eventType: 'group_member_added',
      sourceApp: 'connect',
      verificationMode: 'silent',
      actorName: input.actorName || 'Someone',
      recipientIds: [input.requesterId],
      resourceId: input.resourceId,
      resourceTitle: conversation?.name || conversation?.title || 'Group',
      resourceType: 'group',
      templateKey: 'connect:group-member-added',
      ctaUrl: `/connect/chat/${input.resourceId}`,
      ctaText: 'Open group',
      metadata: { requestId: request.$id, action: input.action },
    }).catch(() => undefined);
  }
  return updated;
}

export async function cancelJoinRequest(input: { userId: string; resourceType: string; resourceId: string }) {
  const { databases } = createSystemClient();
  const resourceType = normalizeResourceType(input.resourceType);
  const request = await getJoinRequest(databases, resourceType, input.resourceId, input.userId);
  if (!request) throw new Error('Join request not found');
  await databases.deleteRow(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, request.$id);
}
