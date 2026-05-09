import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';

function isAdminUser(user: any) {
  return Array.isArray(user?.labels) && user.labels.includes('admin');
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
    const actor = await verifyUser(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const admin = isAdminUser(actor);

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400, headers: corsHeaders });
    }

    if (action === 'state') {
      const result = await InternalKylrixTokenService.getState();
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'initialize') {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.initializeState();
      return NextResponse.json({ initialized: true, state: result }, { headers: corsHeaders });
    }

    if (action === 'mint_activity') {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.mintForActivity({
        userId: String(body?.userId || '').trim(),
        idempotencyKey: String(body?.idempotencyKey || '').trim(),
        activityType: body?.activityType,
        uniqueActors: Number(body?.uniqueActors || 0),
        trustScore: Number(body?.trustScore || 0),
        sourceType: String(body?.sourceType || 'activity'),
        sourceId: String(body?.sourceId || ''),
        metadata: body?.metadata || undefined,
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'transfer') {
      const fromUserId = String(body?.fromUserId || '').trim();
      if (!admin && fromUserId !== actor.$id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.transfer({
        fromUserId,
        toUserId: String(body?.toUserId || '').trim(),
        amountMicro: String(body?.amountMicro || ''),
        idempotencyKey: String(body?.idempotencyKey || '').trim(),
        sourceType: String(body?.sourceType || 'transfer'),
        sourceId: String(body?.sourceId || ''),
        metadata: body?.metadata || undefined,
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'ledger') {
      const userId = String(body?.userId || actor.$id || '').trim();
      if (!admin && userId !== actor.$id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const rows = await InternalKylrixTokenService.listUserLedger(userId, Number(body?.limit || 100));
      return NextResponse.json({ rows }, { headers: corsHeaders });
    }

    if (action === 'fine_to_root') {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.fineToRoot({
        userId: String(body?.userId || '').trim(),
        amountMicro: String(body?.amountMicro || ''),
        idempotencyKey: String(body?.idempotencyKey || '').trim(),
        reason: String(body?.reason || 'policy_violation'),
        sourceType: String(body?.sourceType || 'moderation'),
        sourceId: String(body?.sourceId || ''),
        metadata: body?.metadata || undefined,
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'lock_claim') {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.lockClaim({
        userId: String(body?.userId || '').trim(),
        amountMicro: String(body?.amountMicro || ''),
        destinationWallet: String(body?.destinationWallet || '').trim(),
        chain: String(body?.chain || 'sol').trim(),
        idempotencyKey: String(body?.idempotencyKey || '').trim(),
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (action === 'settle_claim') {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
      const result = await InternalKylrixTokenService.settleClaim({
        userId: String(body?.userId || '').trim(),
        amountMicro: String(body?.amountMicro || ''),
        destinationWallet: String(body?.destinationWallet || '').trim(),
        chain: String(body?.chain || 'sol').trim(),
        onchainTxHash: String(body?.onchainTxHash || '').trim(),
        idempotencyKey: String(body?.idempotencyKey || '').trim(),
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400, headers: corsHeaders });
  } catch (error: any) {
    const message = String(error?.message || 'Token operation failed');
    const status = message === 'TOKEN_NOT_INITIALIZED' ? 409 : 500;
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
