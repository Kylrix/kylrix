import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

function buildMessagePermissions(senderId: string, recipientIds: string[]) {
  return [
    Permission.read(Role.user(senderId)),
    Permission.update(Role.user(senderId)),
    Permission.delete(Role.user(senderId)),
    ...recipientIds.map((userId) => Permission.read(Role.user(userId))),
  ];
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const senderId = String(body?.senderId || '').trim();
    const content = String(body?.content || '');
    const type = String(body?.type || 'text');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400, headers: corsHeaders });
    }

    if (!senderId) {
      return NextResponse.json({ error: 'senderId is required' }, { status: 400, headers: corsHeaders });
    }

    if (user.$id !== senderId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const conversation = await databases.getDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS,
      conversationId,
    );

    const participants = Array.isArray(conversation?.participants)
      ? Array.from(new Set(conversation.participants.filter((participant: unknown): participant is string => typeof participant === 'string' && participant.trim().length > 0)))
      : [];

    if (participants.length === 0 || !participants.includes(senderId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const recipientIds = participants.filter((participantId) => participantId !== senderId);
    const now = new Date().toISOString();

    const message = await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.MESSAGES,
      ID.unique(),
      {
        conversationId,
        senderId,
        content,
        type,
        attachments: Array.isArray(body?.attachments) ? body.attachments : [],
        replyTo: body?.replyTo || null,
        readBy: [senderId],
        createdAt: now,
        updatedAt: now,
      },
      buildMessagePermissions(senderId, recipientIds),
    );

    return NextResponse.json(message, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message || 'Failed to create message';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Connect Message Create API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
