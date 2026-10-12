import { NextRequest, NextResponse } from 'next/server';
import { PairingService } from '@/lib/services/pairing';
import { pairingRequestInputZod } from '@/sdk/contracts/pairing';

export async function handlePairingUnauthenticated(req: NextRequest, parts: string[]) {
  const method = req.method.toUpperCase();
  const subsegment = parts[1];

  // POST /api/v1/pairing/request
  if (method === 'POST' && subsegment === 'request') {
    try {
      const rawBody = await req.json().catch(() => ({}));
      const parsed = pairingRequestInputZod.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: { code: 'bad_request', message: parsed.error.issues[0]?.message || 'Invalid input' } },
          { status: 400 }
        );
      }

      const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const session = await PairingService.requestPairing(parsed.data, baseUrl);
      return NextResponse.json({ ok: true, data: session });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { code: 'server_error', message: err.message || 'Failed to request pairing' } },
        { status: 500 }
      );
    }
  }

  // GET /api/v1/pairing/verify?code=...
  if (method === 'GET' && subsegment === 'verify') {
    try {
      const code = req.nextUrl.searchParams.get('code') || '';
      if (!code) {
        return NextResponse.json(
          { ok: false, error: { code: 'bad_request', message: 'Pairing code is required' } },
          { status: 400 }
        );
      }
      const session = await PairingService.lookupByUserCode(code);
      if (!session) {
        return NextResponse.json({ ok: true, data: { found: false } });
      }
      return NextResponse.json({ ok: true, data: { found: true, session } });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { code: 'server_error', message: err.message || 'Verification failed' } },
        { status: 500 }
      );
    }
  }

  // POST /api/v1/pairing/approve
  if (method === 'POST' && subsegment === 'approve') {
    try {
      const rawBody = await req.json().catch(() => ({}));
      const code = String(rawBody.code || rawBody.userCode || '').trim();
      const action = rawBody.action === 'deny' ? 'deny' : 'approve';
      const grantedScopes = Array.isArray(rawBody.grantedScopes) ? rawBody.grantedScopes : undefined;

      if (!code) {
        return NextResponse.json(
          { ok: false, error: { code: 'bad_request', message: 'userCode is required' } },
          { status: 400 }
        );
      }

      // Try discovering logged-in user:
      // 1. Check web session cookie via getActor()
      let userId: string | undefined;
      try {
        const { getActor } = await import('@/lib/actions/secure-ops');
        const sessionActor = await getActor();
        if (sessionActor?.$id) {
          userId = sessionActor.$id;
        }
      } catch {}

      // 2. Fallback to API Bearer token if provided
      if (!userId) {
        try {
          const { resolveApiActor } = await import('@/lib/api/guard');
          const apiActor = await resolveApiActor(req);
          userId = apiActor.userId;
        } catch {}
      }

      // 3. Fallback to userId passed in body if already authenticated on client
      if (!userId && rawBody.userId) {
        userId = String(rawBody.userId).trim();
      }

      if (!userId && action === 'approve') {
        return NextResponse.json(
          { ok: false, error: { code: 'unauthorized', message: 'You must be signed in to authorize this client' } },
          { status: 401 }
        );
      }

      const result = await PairingService.decidePairing({
        userCode: code,
        userId: userId || 'anonymous',
        action,
        grantedScopes,
      });

      return NextResponse.json({ ok: true, data: result });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { code: 'server_error', message: err.message || 'Approval failed' } },
        { status: 500 }
      );
    }
  }

  // POST /api/v1/pairing/exchange
  if (method === 'POST' && subsegment === 'exchange') {
    try {
      const rawBody = await req.json().catch(() => ({}));
      const deviceCode = String(rawBody.device_code || rawBody.deviceCode || '').trim();
      if (!deviceCode) {
        return NextResponse.json(
          { ok: false, error: { code: 'bad_request', message: 'device_code is required' } },
          { status: 400 }
        );
      }

      const result = await PairingService.exchangeDeviceCode(deviceCode);
      if (result.status === 'authorization_pending') {
        return NextResponse.json({ ok: false, error: { code: 'authorization_pending', message: 'Authorization pending user approval' } }, { status: 428 });
      }
      if (result.status === 'expired') {
        return NextResponse.json({ ok: false, error: { code: 'expired_token', message: 'Pairing code has expired' } }, { status: 400 });
      }
      if (result.status === 'access_denied') {
        return NextResponse.json({ ok: false, error: { code: 'access_denied', message: result.error || 'Access denied' } }, { status: 403 });
      }

      return NextResponse.json({
        ok: true,
        data: {
          access_token: result.token,
          token_type: 'Bearer',
          user_id: result.userId,
          scopes: result.scopes,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: { code: 'server_error', message: err.message || 'Exchange failed' } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'Not found' } }, { status: 404 });
}
