import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'node:crypto';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { trackEngagementView } from '@/lib/services/internal/engagement-views';

const VIEWER_COOKIE = 'kylrix_viewer_v1';

function viewerSecret() {
  return String(process.env.VIEWER_TOKEN_SECRET || process.env.APPWRITE_API || 'kylrix-viewer-secret');
}

function signViewerToken(payload: string) {
  return createHmac('sha256', viewerSecret()).update(payload).digest('base64url');
}

function issueViewerToken() {
  const payload = `${Date.now()}.${randomBytes(16).toString('base64url')}`;
  const sig = signViewerToken(payload);
  return `${payload}.${sig}`;
}

function isViewerTokenValid(token: string) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return false;
  const parts = trimmed.split('.');
  if (parts.length < 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const sig = parts[2];
  return signViewerToken(payload) === sig;
}

function ipFromRequest(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '';
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
    const body = await req.json().catch(() => ({}));
    const user = await verifyUser(req).catch(() => null);

    const existingToken = req.cookies.get(VIEWER_COOKIE)?.value || '';
    const token = isViewerTokenValid(existingToken) ? existingToken : issueViewerToken();
    const viewerKind = user?.$id ? 'user' : 'anon';

    const result = await trackEngagementView({
      appId: String(body?.appId || '').trim(),
      contentType: String(body?.contentType || '').trim(),
      contentId: String(body?.contentId || '').trim(),
      ownerUserId: String(body?.ownerUserId || '').trim() || null,
      viewerKind,
      viewerUserId: user?.$id || null,
      viewerTokenHash: token,
      fingerprint: String(body?.fingerprint || '').trim() || null,
      ip: ipFromRequest(req),
      userAgent: req.headers.get('user-agent') || null,
      conversationId: String(body?.conversationId || '').trim() || null,
      messageId: String(body?.messageId || '').trim() || null,
      receiptType: String(body?.receiptType || '').trim() as 'seen' | 'delivered' | null,
      occurredAt: String(body?.occurredAt || '').trim() || null,
      metadata: body?.metadata || null,
    });

    const response = NextResponse.json(result, { headers: corsHeaders });
    if (token !== existingToken) {
      response.cookies.set(VIEWER_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message || 'Failed to track engagement view') },
      { status: 500, headers: corsHeaders },
    );
  }
}
