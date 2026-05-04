import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONVERSATIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
const CONVERSATION_MEMBERS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATION_MEMBERS;
const GROUP_AVATAR_BUCKET_ID = APPWRITE_CONFIG.BUCKETS.GROUP_AVATARS;

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.map((value) => String(value || '').trim()).filter(Boolean)));
}

function isInviteEnabled(conversation: any) {
  const inviteToken = String(conversation?.inviteLink || '').trim();
  if (!inviteToken || (inviteToken !== conversation?.$id && inviteToken !== conversation?.id)) return false;

  const expiryRaw = conversation?.inviteLinkExpiry;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      return false;
    }
  }

  return true;
}

async function isConversationMember(databases: ReturnType<typeof createAdminClient>['databases'], conversation: any, userId: string) {
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

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const conversationId = new URL(req.url).searchParams.get('conversationId')?.trim();
    const width = Number(new URL(req.url).searchParams.get('width') || 256);
    const height = Number(new URL(req.url).searchParams.get('height') || 256);

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const conversation = await databases.getDocument(CHAT_DB_ID, CONVERSATIONS_TABLE_ID, conversationId).catch(() => null);
    if (!conversation) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404, headers: corsHeaders });
    }

    const inviteEnabled = isInviteEnabled(conversation);
    const user = await verifyUser(req).catch(() => null);
    if (!inviteEnabled && !(user && (await isConversationMember(databases, conversation, user.$id)))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const avatarFileId = String(conversation?.avatarFileId || '').trim();
    if (!avatarFileId) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404, headers: corsHeaders });
    }

    const previewUrl = new URL(
      `${APPWRITE_CONFIG.ENDPOINT}/storage/buckets/${GROUP_AVATAR_BUCKET_ID}/files/${avatarFileId}/preview`
    );
    if (Number.isFinite(width) && width > 0) previewUrl.searchParams.set('width', String(Math.min(width, 1024)));
    if (Number.isFinite(height) && height > 0) previewUrl.searchParams.set('height', String(Math.min(height, 1024)));

    const response = await fetch(previewUrl.toString(), {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
        'X-Appwrite-Key': process.env.APPWRITE_API || '',
        Accept: 'image/*',
      },
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      const message = body?.message || 'Failed to load avatar';
      return NextResponse.json({ error: message }, { status: response.status || 400, headers: corsHeaders });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to load group avatar';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Group Avatar API] Error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
