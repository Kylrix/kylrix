import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import { getCorsHeaders, normalizeTargetUserIds, upsertLockboxRows, verifyUser } from '@/lib/api/permission-updater';
import { applyPermissionMutation, revokePermissionMutation } from '@/lib/services/internal/permissions';

const DEFAULT_GHOST_RESOURCE_TYPE = 'ghost_note';

function getAction(body: any): string {
  return String(body?.action || 'grant').trim();
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    const body = await req.json();
    const action = getAction(body);

    if (action === 'pin_ghost_note') {
      const noteIds = normalizeTargetUserIds(body?.noteIds || body?.resourceIds || body?.resourceId);
      const wrappedKey = body?.wrappedKey || body?.ghostSecret;
      if (noteIds.length === 0) return NextResponse.json({ error: 'At least one noteId is required' }, { status: 400, headers: corsHeaders });
      if (!wrappedKey) return NextResponse.json({ error: 'wrappedKey is required' }, { status: 400, headers: corsHeaders });
      const keyMappings = noteIds.map((noteId) => ({
        resourceId: noteId,
        resourceType: body?.resourceType || DEFAULT_GHOST_RESOURCE_TYPE,
        grantee: user.$id,
        wrappedKey,
        metadata: body?.metadata || null,
      }));
      const { databases } = createAdminClient();
      const rows = await upsertLockboxRows(databases, user.$id, keyMappings);
      return NextResponse.json({ success: true, action, rows }, { headers: corsHeaders });
    }

    const result = await applyPermissionMutation(user.$id, body);
    return NextResponse.json(
      {
        success: true,
        action,
        rowId: body?.rowId || null,
        permissions: (result as any)?.permissions || null,
        storagePermissions: null,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to update permissions';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  try {
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    const body = await req.json().catch(() => ({}));
    const queryTargetUserId = new URL(req.url).searchParams.get('targetUserId');
    await revokePermissionMutation(user.$id, body, queryTargetUserId);
    return NextResponse.json({ success: true, action: 'revoke', rowId: body?.rowId || null, permissions: null }, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message || 'Failed to revoke permissions';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
