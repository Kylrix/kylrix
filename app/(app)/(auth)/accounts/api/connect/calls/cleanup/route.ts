import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';

function isAdminUser(user: any) {
  return Array.isArray(user?.labels) && user.labels.includes('admin');
}

async function deleteExpiredCalls(databases: ReturnType<typeof createAdminClient>['databases'], userId: string, callId?: string | null) {
  const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

  if (callId) {
    const call = await databases.getDocument(DB_ID, LINKS_TABLE, callId);
    if (String((call as any)?.userId || '') !== userId) {
      throw new Error('Forbidden');
    }
    const result = await deleteCallIfExpired(databases as any, callId);
    return result.deleted ? { deleted: 1, callIds: [callId] } : { deleted: 0, callIds: [] as string[] };
  }

  const expiredRows = await databases.listDocuments(DB_ID, LINKS_TABLE, [
    Query.equal('userId', userId),
    Query.lessThan('expiresAt', new Date().toISOString()),
    Query.limit(200),
  ]);

  for (const row of expiredRows.documents) {
    await databases.deleteDocument(DB_ID, LINKS_TABLE, row.$id);
  }

  return { deleted: expiredRows.documents.length, callIds: expiredRows.documents.map((row) => row.$id) };
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
    const requester = await verifyUser(req);
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body?.userId || requester.$id || '').trim();
    const callId = String(body?.callId || '').trim() || null;
    const cleanupAll = Boolean(body?.cleanupAll);

    if (!targetUserId && !cleanupAll) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400, headers: corsHeaders });
    }

    if (targetUserId !== requester.$id && !isAdminUser(requester) && !callId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const result = callId
      ? await deleteExpiredCalls(databases, isAdminUser(requester) ? (targetUserId || requester.$id) : requester.$id, callId)
      : await deleteExpiredCalls(databases, targetUserId || requester.$id, null);

    if (cleanupAll && isAdminUser(requester)) {
      const rows = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASES.CHAT,
        APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS,
        [
          Query.lessThan('expiresAt', new Date().toISOString()),
          Query.limit(500),
        ],
      );

      for (const row of rows.documents) {
        await databases.deleteDocument(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS, row.$id);
      }

      return NextResponse.json({ deleted: rows.documents.length, callIds: rows.documents.map((row) => row.$id) }, { headers: corsHeaders });
    }

    const presenceUser = targetUserId || requester.$id;
    await reconcileStaleLiveCallPresenceForUser(presenceUser).catch(() => undefined);

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Connect Calls Cleanup] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cleanup calls' }, { status: 500, headers: corsHeaders });
  }
}
