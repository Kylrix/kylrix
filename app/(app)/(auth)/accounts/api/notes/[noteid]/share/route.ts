import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  getCorsHeaders,
  mutateRowPermissions,
  verifyUser,
} from '@/lib/api/permission-updater';

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ noteid: string }> }) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const { noteid } = await params;
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { databases } = createAdminClient();
    const result = await mutateRowPermissions(databases, user.$id, {
      databaseId: body?.databaseId || APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: body?.tableId || APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: body?.rowId || noteid,
      targetUserIds: body?.targetUserIds || body?.recipientUserIds || body?.targetUserId,
      permission: body?.permission,
      action: 'grant',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Note permissions updated',
        permissions: result.permissions,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    console.error('API share note error:', error);
    const message = error?.message || 'Failed to share note';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ noteid: string }> }) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const { noteid } = await params;
    const url = new URL(req.url);
    const queryTargetUserId = url.searchParams.get('targetUserId');
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { databases } = createAdminClient();
    const result = await mutateRowPermissions(databases, user.$id, {
      databaseId: body?.databaseId || APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: body?.tableId || APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: body?.rowId || noteid,
      targetUserIds: body?.targetUserIds || body?.recipientUserIds || body?.targetUserId || queryTargetUserId,
      action: 'revoke',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Sharing removed successfully',
        permissions: result.permissions,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    console.error('API remove share error:', error);
    const message = error?.message || 'Failed to remove sharing';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
