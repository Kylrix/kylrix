import { ID, Permission, Role, Query, TablesDB } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createHash } from 'node:crypto';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const MESSAGES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
const MESSAGE_REACTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS;
const CONVERSATION_MEMBERS_TABLE_ID = 'conversationMembers';

export function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function buildMessagePermissions(senderId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(senderId)),
    Permission.update(Role.user(senderId)),
    Permission.delete(Role.user(senderId)),
    ...recipientIds.map((userId) => Permission.read(Role.user(userId))),
  ];
}

export function buildReactionPermissions(userId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    ...recipientIds.map((participantId) => Permission.read(Role.user(participantId))),
  ];
}

export function buildReactionDocumentId(userId: string, messageId: string) {
  return createHash('sha256')
    .update(`${userId}:${messageId}`)
    .digest('base64url')
    .slice(0, 32);
}

export function normalizeParticipantIds(row: any): string[] {
  return Array.isArray(row?.participants)
    ? Array.from(new Set(row.participants.filter((participant: unknown): participant is string => typeof participant === 'string' && participant.trim().length > 0)))
    : [];
}

export async function resolveConversationParticipants(databases: any, conversation: any): Promise<string[]> {
  const directParticipants = normalizeParticipantIds(conversation);
  if (directParticipants.length > 0) return directParticipants;

  const memberRows = await databases.listDocuments(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
    Query.equal('conversationId', conversation.$id),
    Query.limit(1000),
  ]).catch(() => ({ documents: [] }));

  return Array.from(new Set<string>(
    (memberRows.documents || [])
      .map((row: any) => row.userId)
      .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.trim().length > 0),
  ));
}

export async function createMessageInternal(payload: {
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: string[];
  replyTo?: string;
  jwt?: string;
}) {
  const { account } = await createServerClient(payload.jwt ? new Request('http://localhost', { headers: { authorization: `Bearer ${payload.jwt}` } }) : undefined);
  const user = await account.get().catch(() => null);

  if (!user) throw new Error('Unauthorized');
  if (user.$id !== payload.senderId) throw new Error('Forbidden');

  const { databases } = createAdminClient();
  const conversation = await databases.getDocument(
    CHAT_DB_ID,
    CONVERSATIONS_TABLE_ID,
    payload.conversationId,
  );

  const participants = await resolveConversationParticipants(databases, conversation);

  if (participants.length === 0 || !participants.includes(payload.senderId)) {
    throw new Error('Forbidden: Not a participant');
  }

  const recipientIds = participants.filter((id) => id !== payload.senderId);
  const now = new Date().toISOString();

  const message = await databases.createDocument(
    CHAT_DB_ID,
    MESSAGES_TABLE_ID,
    ID.unique(),
    {
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      content: payload.content,
      type: payload.type || 'text',
      attachments: payload.attachments || [],
      replyTo: payload.replyTo || null,
      readBy: [payload.senderId],
      createdAt: now,
      updatedAt: now,
    },
    buildMessagePermissions(payload.senderId, recipientIds),
  );

  return JSON.parse(JSON.stringify(message));
}

export async function toggleReactionInternal(payload: {
  conversationId: string;
  messageId: string;
  emoji: string;
  action: 'POST' | 'DELETE';
  jwt?: string;
}) {
  const { account } = await createServerClient(payload.jwt ? new Request('http://localhost', { headers: { authorization: `Bearer ${payload.jwt}` } }) : undefined);
  const user = await account.get().catch(() => null);

  if (!user) throw new Error('Unauthorized');

  const { databases } = createAdminClient();
  const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.conversationId);
  const participantIds = await resolveConversationParticipants(databases, conversation);

  if (!participantIds.includes(user.$id)) {
    throw new Error('Forbidden: Not a participant');
  }

  if (payload.action === 'DELETE') {
    const existing = await databases.listDocuments(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, [
      Query.equal('userId', user.$id),
      Query.equal('messageId', payload.messageId),
      Query.equal('emoji', payload.emoji),
    ]);

    for (const row of existing.documents) {
      await databases.deleteDocument(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, row.$id);
    }

    return { success: true };
  } else {
    const now = new Date().toISOString();
    const reactionPayload = {
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      userId: user.$id,
      emoji: payload.emoji,
      createdAt: now,
    };

    const recipientIds = participantIds.filter((id) => id !== user.$id);
    const permissions = buildReactionPermissions(user.$id, recipientIds);
    const docId = buildReactionDocumentId(user.$id, payload.messageId);

    try {
      const reaction = await databases.createDocument(
        CHAT_DB_ID,
        MESSAGE_REACTIONS_TABLE_ID,
        docId,
        reactionPayload,
        permissions,
      );
      return JSON.parse(JSON.stringify(reaction));
    } catch (error: any) {
      if (error?.code === 409) {
        const reaction = await databases.updateDocument(
          CHAT_DB_ID,
          MESSAGE_REACTIONS_TABLE_ID,
          docId,
          reactionPayload,
          permissions,
        );
        return JSON.parse(JSON.stringify(reaction));
      }
      throw error;
    }
  }
}

export async function repairConversationInternal(payload: {
  userId?: string;
  conversationId?: string;
  jwt?: string;
}) {
  const { account } = await createServerClient(payload.jwt ? new Request('http://localhost', { headers: { authorization: `Bearer ${payload.jwt}` } }) : undefined);
  const user = await account.get().catch(() => null);

  if (!user) throw new Error('Unauthorized');

  const targetUserId = payload.userId || user.$id;
  const isAdmin = Array.isArray(user.labels) && user.labels.includes('admin');

  if (user.$id !== targetUserId && !isAdmin) {
    throw new Error('Forbidden');
  }

  const { databases } = createAdminClient();
  const report: any = {
    userId: targetUserId,
    conversationId: payload.conversationId || null,
    identity: { repaired: false, deleted: 0 },
    mappings: { repaired: 0, deleted: 0 },
  };

  // 1. Repair Identity
  const profiles = await databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
    Query.equal('userId', targetUserId),
    Query.limit(1),
  ]);
  const profile = profiles.documents[0] || null;

  const identities = await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
    APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
    [
      Query.equal('userId', targetUserId),
      Query.equal('identityType', 'e2e_connect'),
      Query.limit(100),
    ],
  );

  const identityRows = identities.documents;
  const canonicalIdentity =
    identityRows.find((row: any) => row?.publicKey && row?.publicKey === profile?.publicKey) ||
    identityRows.find((row: any) => row?.publicKey) ||
    identityRows[0] ||
    null;

  if (canonicalIdentity) {
    const duplicateRows = identityRows.filter((row: any) => row.$id !== canonicalIdentity.$id);
    for (const duplicate of duplicateRows) {
      await databases.deleteDocument(
        APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
        APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
        duplicate.$id,
      );
    }
    report.identity = {
      repaired: true,
      deleted: duplicateRows.length,
      canonicalId: canonicalIdentity.$id,
    };

    if (profile && profile.publicKey !== canonicalIdentity.publicKey) {
      await databases.updateDocument(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        profile.$id,
        {
          publicKey: canonicalIdentity.publicKey || null,
        },
      );
      report.identity.profilePublicKeyUpdated = true;
    }
  }

  // 2. Repair Conversation Key Mappings (if conversationId provided)
  if (payload.conversationId) {
    const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.conversationId);
    const participantIds = await resolveConversationParticipants(databases, conversation);

    if (participantIds.length > 0 && !participantIds.includes(targetUserId) && !isAdmin) {
      throw new Error('Forbidden: Not a participant');
    }

    const epochRows = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.EPOCHS,
      [
        Query.equal('resourceId', payload.conversationId),
        Query.limit(100),
      ],
    );
    const epochIds = epochRows.documents.map((row) => row.$id);

    const mappings = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
      APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
      [
        Query.equal('grantee', targetUserId),
        Query.limit(1000),
      ],
    );

    const relevantMappings = mappings.documents.filter((row: any) => {
      if (row.resourceType === 'chat' && row.resourceId === payload.conversationId) return true;
      if (row.resourceType === 'epoch' && epochIds.includes(row.resourceId)) return true;
      return false;
    });

    const grouped = new Map<string, any[]>();
    for (const row of relevantMappings) {
      const key = `${row.resourceType}:${row.resourceId}:${row.grantee}`;
      const current = grouped.get(key) || [];
      current.push(row);
      grouped.set(key, current);
    }

    let repairedRows = 0;
    let deletedRows = 0;

    for (const rows of grouped.values()) {
      rows.sort((left, right) => {
        const leftMeta = typeof left.metadata === 'string' ? JSON.parse(left.metadata || '{}') : (left.metadata || {});
        const rightMeta = typeof right.metadata === 'string' ? JSON.parse(right.metadata || '{}') : (right.metadata || {});
        const leftScore = (leftMeta.senderPublicKey ? 2 : 0) + (leftMeta.wrappedByPublicKey ? 1 : 0);
        const rightScore = (rightMeta.senderPublicKey ? 2 : 0) + (rightMeta.wrappedByPublicKey ? 1 : 0);
        if (rightScore !== leftScore) return rightScore - leftScore;
        return new Date(right.$createdAt || right.createdAt || 0).getTime() - new Date(left.$createdAt || left.createdAt || 0).getTime();
      });

      const canonical = rows[0];
      const metadata = typeof canonical.metadata === 'string' ? JSON.parse(canonical.metadata || '{}') : (canonical.metadata || {});
      
      if (metadata.wrappedBy && !metadata.wrappedByPublicKey) {
        try {
          const wrappedByProfiles = await databases.listDocuments(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.PROFILES, [
            Query.equal('userId', String(metadata.wrappedBy)),
            Query.limit(1),
          ]);
          const wrappedByProfile = wrappedByProfiles.documents[0];
          if (wrappedByProfile?.publicKey) {
            metadata.wrappedByPublicKey = wrappedByProfile.publicKey;
          }
        } catch { /* best effort */ }
      }

      if (Object.keys(metadata).length > 0) {
        await databases.updateDocument(
          APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
          APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
          canonical.$id,
          { metadata: JSON.stringify(metadata) },
        );
        repairedRows += 1;
      }

      for (const duplicate of rows.slice(1)) {
        await databases.deleteDocument(
          APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
          APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.KEY_MAPPING,
          duplicate.$id,
        );
        deletedRows += 1;
      }
    }

    report.mappings = {
      repaired: repairedRows,
      deleted: deletedRows,
      considered: relevantMappings.length,
    };
  }

  return JSON.parse(JSON.stringify(report));
}

export async function joinRequestInternal(payload: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  resourceType: string,
  resourceId: string,
  requesterId?: string,
  action?: 'accept' | 'reject',
  jwt?: string;
}) {
  const { account } = await createServerClient(payload.jwt ? new Request('http://localhost', { headers: { authorization: `Bearer ${payload.jwt}` } }) : undefined);
  const user = await account.get().catch(() => null);

  const { databases } = createAdminClient();
  const JOIN_REQUESTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS;

  if (payload.method === 'GET') {
    const resource = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.resourceId);
    const currentRequesterId = payload.requesterId || user?.$id || '';
    
    let alreadyJoined = false;
    if (currentRequesterId) {
      const memberRows = await databases.listDocuments(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
        Query.equal('conversationId', payload.resourceId),
        Query.equal('userId', currentRequesterId),
        Query.limit(1),
      ]).catch(() => ({ documents: [] }));
      alreadyJoined = memberRows.documents.length > 0;
    }

    let request = null;
    if (currentRequesterId) {
      const existing = await databases.listDocuments(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
        Query.equal('resourceType', payload.resourceType),
        Query.equal('resourceId', payload.resourceId),
        Query.equal('requesterId', currentRequesterId),
        Query.limit(1),
      ]);
      request = existing.documents[0] || null;
    }

    return JSON.parse(JSON.stringify({
      alreadyJoined,
      request,
    }));
  }

  if (!user) throw new Error('Unauthorized');

  if (payload.method === 'POST') {
    const requestId = buildReactionDocumentId(user.$id, payload.resourceId);
    const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.resourceId);
    const managers = normalizeParticipantIds(conversation);

    const request = await databases.createDocument(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      requestId,
      {
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        requesterId: user.$id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        ...managers.map((id) => Permission.read(Role.user(id))),
      ],
    );

    return JSON.parse(JSON.stringify(request));
  }

  if (payload.method === 'PATCH') {
    if (!payload.action || !payload.requesterId) throw new Error('action and requesterId required');
    
    const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, payload.resourceId);
    const managers = normalizeParticipantIds(conversation);
    if (!managers.includes(user.$id)) throw new Error('Forbidden');

    const existing = await databases.listDocuments(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
      Query.equal('resourceType', payload.resourceType),
      Query.equal('resourceId', payload.resourceId),
      Query.equal('requesterId', payload.requesterId),
      Query.limit(1),
    ]);
    const request = existing.documents[0];
    if (!request) throw new Error('Not found');

    const nextStatus = payload.action === 'accept' ? 'accepted' : 'rejected';
    const updated = await databases.updateDocument(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      request.$id,
      {
        status: nextStatus,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.$id,
      }
    );

    if (payload.action === 'accept') {
      const participants = uniqueIds([...normalizeParticipantIds(conversation), payload.requesterId]);
      await databases.updateDocument(
        CHAT_DB_ID,
        CONVERSATIONS_TABLE_ID,
        payload.resourceId,
        {
          participants,
          participantCount: participants.length,
          updatedAt: new Date().toISOString(),
        }
      );
      
      await databases.createDocument(
        CHAT_DB_ID,
        CONVERSATION_MEMBERS_TABLE_ID,
        ID.unique(),
        {
          conversationId: payload.resourceId,
          userId: payload.requesterId,
        }
      ).catch(() => null);
    }

    return JSON.parse(JSON.stringify(updated));
  }

  if (payload.method === 'DELETE') {
    const existing = await databases.listDocuments(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
      Query.equal('resourceType', payload.resourceType),
      Query.equal('resourceId', payload.resourceId),
      Query.equal('requesterId', user.$id),
    ]);

    for (const row of existing.documents) {
      await databases.deleteDocument(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, row.$id);
    }

    return { success: true };
  }

  throw new Error('Unsupported method');
}
