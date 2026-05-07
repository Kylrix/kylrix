import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { cancelJoinRequest, createJoinRequest, loadJoinRequestPreview, resolveJoinRequest } from '@/lib/services/internal/joinRequests';

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
    const resourceType = String(new URL(req.url).searchParams.get('resourceType') || '');
    const resourceId = String(new URL(req.url).searchParams.get('resourceId') || '');
    const requesterId = String(new URL(req.url).searchParams.get('requesterId') || '');
    const user = await verifyUser(req).catch(() => null);

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    const currentRequesterId = requesterId || user?.$id || '';
    const { conversation, alreadyJoined, request } = await loadJoinRequestPreview({
      resourceType,
      resourceId,
      requesterId: currentRequesterId,
    });

    return NextResponse.json(
      {
        resource: {
          resourceType: 'chat.conversation',
          resourceId: conversation?.$id,
          name: conversation?.name || null,
          avatarUrl: conversation?.avatarUrl || null,
          avatarFileId: conversation?.avatarFileId || null,
          description: null,
          participantCount: Number(conversation?.participantCount || conversation?.participants?.length || 0),
          inviteEnabled: true,
        },
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
    const resourceType = String(body?.resourceType || '');
    const resourceId = String(body?.resourceId || '');

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    const result = await createJoinRequest({
      userId: user.$id,
      resourceType,
      resourceId,
    });

    return NextResponse.json(
      {
        success: true,
        alreadyJoined: result.alreadyJoined,
        request: result.request,
        resource: {
          resourceType: 'chat.conversation',
          resourceId: result.conversation?.$id,
          name: result.conversation?.name || null,
          avatarUrl: result.conversation?.avatarUrl || null,
          avatarFileId: result.conversation?.avatarFileId || null,
          description: null,
          participantCount: Number(result.conversation?.participantCount || result.conversation?.participants?.length || 0),
          inviteEnabled: true,
        },
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
    const action = String(body?.action || '').toLowerCase();
    const resourceType = String(body?.resourceType || '');
    const resourceId = String(body?.resourceId || '');
    const requesterId = String(body?.requesterId || '');

    if (!resourceType || !resourceId || !requesterId) {
      return NextResponse.json({ error: 'resourceType, resourceId, and requesterId are required' }, { status: 400, headers: corsHeaders });
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400, headers: corsHeaders });
    }

    const updated = await resolveJoinRequest({
      actorId: user.$id,
      actorName: user.name || user.email || 'Someone',
      resourceType,
      resourceId,
      requesterId,
      action: action as 'accept' | 'reject',
    });

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
    const resourceType = String(body?.resourceType || '');
    const resourceId = String(body?.resourceId || '');

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'resourceType and resourceId are required' }, { status: 400, headers: corsHeaders });
    }

    await cancelJoinRequest({
      userId: user.$id,
      resourceType,
      resourceId,
    });

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
