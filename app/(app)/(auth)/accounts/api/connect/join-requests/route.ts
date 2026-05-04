import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, mutateStorageFilePermissions, verifyUser } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const CONVERSATION_MEMBERS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS;
const JOIN_REQUESTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.JOIN_REQUESTS;

type ResourceAdapter = {
  kind: string;
  getPreview: (resource: any) => Record<string, unknown>;
  getManagers: (resource: any) => string[];
  isJoinEnabled: (resource: any) => boolean;
  addMember: (databases: ReturnType<typeof createAdminClient>['databases'], resource: any, userId: string) => Promise<void>;
};

function hashJoinRequestId(resourceType: string, resourceId: string, requesterId: string) {
  return createHash('sha256')
    .update(`${resourceType}:${resourceId}:${requesterId}`)
    .digest('base64url')
    .slice(0, 32);
}

function normalizeText(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeResourceType(input: unknown) {
  const value = normalizeText(input).toLowerCase();
  if (!value) return '';
  if (['chat', 'chat.conversation', 'chat:conversation', 'chat-conversation', 'group', 'groups'].includes(value)) {
    return 'chat.conversation';
  }
  return value;
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.map((value) => normalizeText(value)).filter(Boolean)));
}

function parseInviteMeta(value: unknown) {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function getConversationInviteEnabled(conversation: any) {
  const inviteToken = normalizeText(conversation?.inviteLink);
  if (!inviteToken) return false;

  const expiryRaw = conversation?.inviteLinkExpiry;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      return false;
    }
  }

  return inviteToken === conversation?.$id || inviteToken === conversation?.id;
}

function getConversationManagers(conversation: any) {
  return uniqueIds([conversation?.creatorId, ...(Array.isArray(conversation?.admins) ? conversation.admins : [])]);
}

function getConversationPreview(conversation: any) {
  const inviteMeta = parseInviteMeta(conversation?.inviteMeta);
  const avatarRoute = conversation?.avatarFileId
    ? `${new URL('/api/connect/group-avatar', 'https://accounts.kylrix.space').toString()}?conversationId=${conversation.$id}`
    : null;
  return {
    resourceType: 'chat.conversation',
    resourceId: conversation?.$id,
    name: typeof inviteMeta?.name === 'string' ? inviteMeta.name : null,
    avatarUrl: avatarRoute || conversation?.avatarUrl || null,
    avatarFileId: conversation?.avatarFileId || null,
    description: typeof inviteMeta?.description === 'string' ? inviteMeta.description : null,
    participantCount: Number(conversation?.participantCount || conversation?.participants?.length || 0),
    inviteEnabled: getConversationInviteEnabled(conversation),
    inviteMeta,
  };
}

const resourceAdapters: Record<string, ResourceAdapter> = {
  'chat.conversation': {
    kind: 'chat.conversation',
    getPreview: getConversationPreview,
    getManagers: getConversationManagers,
    isJoinEnabled: getConversationInviteEnabled,
    async addMember(databases, resource, userId) {
      const participants = uniqueIds([...(Array.isArray(resource?.participants) ? resource.participants : []), userId]);
      const managers = getConversationManagers(resource);
      const permissions = [
        Permission.read(Role.user(resource.creatorId)),
        Permission.update(Role.user(resource.creatorId)),
        Permission.delete(Role.user(resource.creatorId)),
        ...participants.flatMap((participantId) => [
          Permission.read(Role.user(participantId)),
          Permission.update(Role.user(participantId)),
        ]),
        ...managers.map((managerId) => Permission.read(Role.user(managerId))),
      ];
      const conversationPayload = {
        participants,
        participantCount: participants.length,
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        databases.updateDocument(
          CHAT_DB_ID,
          CONVERSATIONS_TABLE_ID,
          resource.$id,
          conversationPayload,
          permissions,
        ),
        databases.createDocument(
          CHAT_DB_ID,
          CONVERSATION_MEMBERS_TABLE_ID,
          ID.unique(),
          {
            conversationId: resource.$id,
            userId,
          },
          [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
            ...managers.map((managerId) => Permission.read(Role.user(managerId))),
          ],
        ).catch((error: any) => {
          if (error?.code !== 409) throw error;
          return null;
        }),
      ]);
    },
  },
};

function getAdapter(resourceType: unknown) {
  return resourceAdapters[normalizeResourceType(resourceType)] || null;
}

function buildRequestPermissions(requesterId: string, managers: string[]) {
  return [
    Permission.read(Role.user(requesterId)),
    Permission.update(Role.user(requesterId)),
    Permission.delete(Role.user(requesterId)),
    ...managers.map((managerId) => Permission.read(Role.user(managerId))),
  ];
}

async function getJoinRequest(databases: ReturnType<typeof createAdminClient>['databases'], resourceType: string, resourceId: string, requesterId: string) {
  const existing = await databases.listDocuments(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, [
    Query.equal('resourceType', resourceType),
    Query.equal('resourceId', resourceId),
    Query.equal('requesterId', requesterId),
    Query.limit(1),
  ]);

  return existing.documents[0] || null;
}

async function getConversation(databases: ReturnType<typeof createAdminClient>['databases'], conversationId: string) {
  return databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, conversationId);
}

async function isConversationMember(
  databases: ReturnType<typeof createAdminClient>['databases'],
  conversation: any,
  userId: string,
) {
  if (!userId) return false;

  if (Array.isArray(conversation?.participants) && uniqueIds(conversation.participants).includes(userId)) {
    return true;
  }

  const memberRows = await databases.listDocuments(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
    Query.equal('conversationId', conversation.$id),
    Query.equal('userId', userId),
    Query.limit(1),
  ]).catch(() => ({ documents: [] as any[] }));

  return Boolean(memberRows.documents[0]);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const resourceType = normalizeResourceType(new URL(req.url).searchParams.get('resourceType'));
    const resourceId = normalizeText(new URL(req.url).searchParams.get('resourceId'));
    const requesterId = normalizeText(new URL(req.url).searchParams.get('requesterId'));
    const user = await verifyUser(req).catch(() => null);

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    const adapter = getAdapter(resourceType);
    if (!adapter) {
      return NextResponse.json({ error: 'Unsupported resource type' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const resource = await getConversation(databases, resourceId);
    if (!adapter.isJoinEnabled(resource)) {
      return NextResponse.json({ error: 'Group does not exist' }, { status: 404, headers: corsHeaders });
    }

    const currentRequesterId = requesterId || user?.$id || '';
    const alreadyJoined = currentRequesterId
      ? await isConversationMember(databases, resource, currentRequesterId)
      : false;
    const request = currentRequesterId
      ? await getJoinRequest(databases, resourceType, resourceId, currentRequesterId)
      : null;

    return NextResponse.json(
      {
        resource: adapter.getPreview(resource),
        alreadyJoined,
        request,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to load join request';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Join Requests API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const resourceType = normalizeResourceType(body?.resourceType);
    const resourceId = normalizeText(body?.resourceId);

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    const adapter = getAdapter(resourceType);
    if (!adapter) {
      return NextResponse.json({ error: 'Unsupported resource type' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const resource = await getConversation(databases, resourceId);
    if (!adapter.isJoinEnabled(resource)) {
      return NextResponse.json({ error: 'Group does not exist' }, { status: 404, headers: corsHeaders });
    }

    if (await isConversationMember(databases, resource, user.$id)) {
      return NextResponse.json(
        {
          success: true,
          alreadyJoined: true,
          request: null,
          resource: adapter.getPreview(resource),
        },
        { headers: corsHeaders },
      );
    }

    const existing = await getJoinRequest(databases, resourceType, resourceId, user.$id);
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          request: existing,
          resource: adapter.getPreview(resource),
        },
        { headers: corsHeaders },
      );
    }

    const managers = adapter.getManagers(resource);
    const requestId = hashJoinRequestId(resourceType, resourceId, user.$id);
    const request = await databases.createDocument(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      requestId,
      {
        resourceType,
        resourceId,
        requesterId: user.$id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      buildRequestPermissions(user.$id, managers),
    );

    return NextResponse.json(
      {
        success: true,
        request,
        resource: adapter.getPreview(resource),
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    if (error?.code === 409) {
      return NextResponse.json({ error: 'A request already exists' }, { status: 409, headers: corsHeaders });
    }

    const message = error?.message || 'Failed to create join request';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Join Requests API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function PATCH(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const action = normalizeText(body?.action).toLowerCase();
    const resourceType = normalizeResourceType(body?.resourceType);
    const resourceId = normalizeText(body?.resourceId);
    const requesterId = normalizeText(body?.requesterId);

    if (!resourceType || !resourceId || !requesterId) {
      return NextResponse.json({ error: 'resourceType, resourceId, and requesterId are required' }, { status: 400, headers: corsHeaders });
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400, headers: corsHeaders });
    }

    const adapter = getAdapter(resourceType);
    if (!adapter) {
      return NextResponse.json({ error: 'Unsupported resource type' }, { status: 400, headers: corsHeaders });
    }

    const { databases, storage } = createAdminClient();
    const resource = await getConversation(databases, resourceId);
    const managers = adapter.getManagers(resource);
    if (!managers.includes(user.$id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const request = await getJoinRequest(databases, resourceType, resourceId, requesterId);
    if (!request) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404, headers: corsHeaders });
    }

    const now = new Date().toISOString();
    const nextStatus = action === 'accept' ? 'accepted' : 'rejected';
    const updated = await databases.updateDocument(
      CHAT_DB_ID,
      JOIN_REQUESTS_TABLE_ID,
      request.$id,
      {
        status: nextStatus,
        resolvedAt: now,
        resolvedBy: user.$id,
      },
      buildRequestPermissions(requesterId, managers),
    );

    if (action === 'accept') {
      await adapter.addMember(databases, resource, requesterId);
      if (resource?.avatarFileId) {
        await mutateStorageFilePermissions(storage, user.$id, {
          bucketId: APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS,
          fileId: resource.avatarFileId,
          targetUserIds: [requesterId],
          permission: 'read',
        });
      }

      await fetch(`${process.env.KYLRIX_ACCOUNTS_ORIGIN || 'https://accounts.kylrix.space'}/api/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({
          eventType: 'group_member_added',
          sourceApp: 'connect',
          verificationMode: 'silent',
          actorName: user.name || user.email || 'Someone',
          recipientIds: [requesterId],
          resourceId,
          resourceTitle: resource?.name || resource?.title || 'Group',
          resourceType: 'group',
          templateKey: 'connect:group-member-added',
          ctaUrl: `/connect/chat/${resourceId}`,
          ctaText: 'Open group',
          metadata: {
            requestId: request.$id,
            action,
          },
        }),
      }).catch((error) => {
        console.error('[Join Requests API] Failed to queue member-added email', error);
      });
    }

    return NextResponse.json(
      {
        success: true,
        request: updated,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to resolve join request';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Join Requests API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const resourceType = normalizeResourceType(body?.resourceType);
    const resourceId = normalizeText(body?.resourceId);

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    const adapter = getAdapter(resourceType);
    if (!adapter) {
      return NextResponse.json({ error: 'Unsupported resource type' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    await getConversation(databases, resourceId);
    const request = await getJoinRequest(databases, resourceType, resourceId, user.$id);
    if (!request) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404, headers: corsHeaders });
    }

    await databases.deleteDocument(CHAT_DB_ID, JOIN_REQUESTS_TABLE_ID, request.$id);

    return NextResponse.json(
      {
        success: true,
        deleted: true,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to cancel join request';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Join Requests API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
