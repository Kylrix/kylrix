import { NextRequest, NextResponse } from 'next/server';
import { Client, ID, Permission, Role, Account } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

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

// Helper to verify JWT and get user
async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.split(' ')[1];

  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID)
    .setJWT(jwt);

  try {
    const account = new Account(client);
    return await account.get();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return null;
  }
}

function getCorsHeaders(req: NextRequest) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const { participants, type, name, encryptionKey, creatorId } = await req.json();

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: 'Participants are required' }, { status: 400, headers: corsHeaders });
    }

    // Verify authentication
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Security check: the requester must be the creator or a participant
    if (creatorId !== user.$id && !participants.includes(user.$id)) {
      return NextResponse.json({ error: 'Forbidden: You must be a participant' }, { status: 403, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
    const CONV_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;

    // Construct permissions
    // The creator gets full access
    const permissions = [
      Permission.read(Role.user(creatorId)),
      Permission.update(Role.user(creatorId)),
      Permission.delete(Role.user(creatorId)),
    ];

    // Other participants get read access (and maybe update if we want them to edit group name later)
    participants.forEach(p => {
      if (p !== creatorId) {
        permissions.push(Permission.read(Role.user(p)));
        permissions.push(Permission.update(Role.user(p))); // Allow them to update lastMessageAt etc
      }
    });

    const conversation = await databases.createDocument(
      DB_ID,
      CONV_TABLE,
      ID.unique(),
      {
        participants,
        participantCount: participants.length,
        type: type || 'direct',
        name: name || 'Direct Chat',
        inviteMeta: null,
        inviteLink: null,
        inviteLinkExpiry: null,
        creatorId: creatorId,
        admins: [],
        isPinned: [],
        isMuted: [],
        isArchived: [],
        tags: [],
        isEncrypted: !!encryptionKey,
        encryptionKey: encryptionKey,
        encryptionVersion: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      permissions
    );

    return NextResponse.json(conversation, { headers: corsHeaders });
  } catch (error: any) {
    console.error('API create conversation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create conversation' }, { status: 500, headers: corsHeaders });
  }
}
