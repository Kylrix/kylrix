import { NextRequest, NextResponse } from 'next/server';
import { Permission, Query, Role } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const MESSAGES_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
const CONVERSATION_MEMBERS_TABLE_ID = 'conversationMembers';
const MESSAGE_REACTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGE_REACTIONS;

function buildReactionDocumentId(userId: string, messageId: string) {
  return createHash('sha256')
    .update(`${userId}:${messageId}`)
    .digest('base64url')
    .slice(0, 32);
}

function normalizeEmoji(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

function getReactionSortTime(row: any) {
  return new Date(row?.updatedAt || row?.$updatedAt || row?.createdAt || row?.$createdAt || 0).getTime();
}

function buildReactionPermissions(userId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    ...recipientIds.map((participantId) => Permission.read(Role.user(participantId))),
  ];
}

function normalizeParticipantIds(row: any): string[] {
  return Array.isArray(row?.participants)
    ? Array.from(new Set(row.participants.filter((participant: unknown): participant is string => typeof participant === 'string' && participant.trim().length > 0)))
    : [];
}

async function resolveConversationParticipants(databases: ReturnType<typeof createAdminClient>['databases'], conversation: any): Promise<string[]> {
  const directParticipants = normalizeParticipantIds(conversation);
  if (directParticipants.length > 0) return directParticipants;

  const memberRows = await databases.listDocuments(CHAT_DB_ID, CONVERSATION_MEMBERS_TABLE_ID, [
    Query.equal('conversationId', conversation.$id),
    Query.limit(1000),
  ]).catch(() => ({ documents: [] as any[] }));

  return Array.from(new Set<string>(
    (memberRows.documents || [])
      .map((row: any) => row.userId)
      .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.trim().length > 0),
  ));
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const conversationId = String(body?.conversationId || '').trim();
    const messageId = String(body?.messageId || '').trim();
    const emoji = normalizeEmoji(body?.emoji);

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400, headers: corsHeaders });
    }

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400, headers: corsHeaders });
    }

    if (!emoji) {
      return NextResponse.json({ error: 'emoji is required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, conversationId);
    const message = await databases.getDocument(CHAT_DB_ID, MESSAGES_TABLE_ID, messageId);

    if (message?.conversationId !== conversationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const participantIds = await resolveConversationParticipants(databases, conversation);
    if (!participantIds.includes(user.$id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const now = new Date().toISOString();
    const payload = {
      conversationId,
      messageId,
      userId: user.$id,
      emoji,
      createdAt: now,
    };
    const permissions = buildReactionPermissions(user.$id, participantIds.filter((participantId) => participantId !== user.$id));
    const existing = await databases.listDocuments(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, [
      Query.equal('userId', user.$id),
      Query.equal('messageId', messageId),
      Query.limit(1000),
    ]);

    let reaction;
    const existingRows = (existing.documents || []).slice().sort((left: any, right: any) => getReactionSortTime(right) - getReactionSortTime(left));
    const primaryRow = existingRows[0] || null;

    if (primaryRow) {
      for (const duplicateRow of existingRows.slice(1)) {
        await databases.deleteDocument(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, duplicateRow.$id);
      }

      reaction = await databases.updateDocument(
        CHAT_DB_ID,
        MESSAGE_REACTIONS_TABLE_ID,
        primaryRow.$id,
        payload,
        permissions,
      );
    } else {
      try {
        reaction = await databases.createDocument(
          CHAT_DB_ID,
          MESSAGE_REACTIONS_TABLE_ID,
          buildReactionDocumentId(user.$id, messageId),
          payload,
          permissions,
        );
      } catch (error: any) {
        if (error?.code !== 409) {
          throw error;
        }

        const fallback = await databases.listDocuments(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, [
          Query.equal('userId', user.$id),
          Query.equal('messageId', messageId),
          Query.limit(1000),
        ]);
        const fallbackRows = (fallback.documents || []).slice().sort((left: any, right: any) => getReactionSortTime(right) - getReactionSortTime(left));
        const fallbackPrimary = fallbackRows[0];
        if (!fallbackPrimary) {
          throw error;
        }

        for (const duplicateRow of fallbackRows.slice(1)) {
          await databases.deleteDocument(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, duplicateRow.$id);
        }

        reaction = await databases.updateDocument(
          CHAT_DB_ID,
          MESSAGE_REACTIONS_TABLE_ID,
          fallbackPrimary.$id,
          payload,
          permissions,
        );
      }
    }

    return NextResponse.json(reaction, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message || 'Failed to create reaction';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Connect Message Reaction API] Error:', error);
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
    const conversationId = String(body?.conversationId || '').trim();
    const messageId = String(body?.messageId || '').trim();
    const emoji = normalizeEmoji(body?.emoji);

    if (!conversationId || !messageId || !emoji) {
      return NextResponse.json({ error: 'conversationId, messageId, and emoji are required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const existing = await databases.listDocuments(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, [
      Query.equal('userId', user.$id),
      Query.equal('messageId', messageId),
      Query.limit(1000),
    ]);
    const rowsToDelete = (existing.documents || []).slice().sort((left: any, right: any) => getReactionSortTime(right) - getReactionSortTime(left));
    if (!rowsToDelete.length) {
      return NextResponse.json(
        {
          success: true,
          messageId,
          emoji,
        },
        { headers: corsHeaders },
      );
    }

    for (const row of rowsToDelete) {
      await databases.deleteDocument(CHAT_DB_ID, MESSAGE_REACTIONS_TABLE_ID, row.$id);
    }

    return NextResponse.json(
      {
        success: true,
        messageId,
        emoji,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to remove reaction';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Connect Message Reaction API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
