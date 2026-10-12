import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logDebug, logError } from '@/lib/logger';

/**
 * GitHub Webhook Ingestion Route
 *
 * Receives all webhook events directly from GitHub repositories/organizations.
 * Mandates HMAC-SHA256 signature verification with GITHUB_WEBHOOK_SECRET.
 * Logs event telemetry and dispatches to internal systems/bus.
 */

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const event = req.headers.get('x-github-event') || 'unknown';
    const delivery = req.headers.get('x-github-delivery') || '';
    const signature = req.headers.get('x-hub-signature-256') || '';

    // Mandatory signature verification
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logError('[github-webhook] GITHUB_WEBHOOK_SECRET is not configured on server');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-hub-signature-256' }, { status: 401 });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
    const sigBuf = Buffer.from(signature);
    const digestBuf = Buffer.from(digest);

    if (sigBuf.length !== digestBuf.length || !crypto.timingSafeEqual(sigBuf, digestBuf)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
    }

    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const repoFullName = payload.repository?.full_name || 'unknown';
    const sender = payload.sender?.login || 'unknown';
    const action = payload.action || '';

    // Diagnostics telemetry
    logDebug(`[github-webhook] Event: ${event}${action ? `.${action}` : ''} | Repo: ${repoFullName} | Sender: ${sender} | Delivery: ${delivery}`);

    // High-level metadata for plugin systems to act upon
    // (Ping event response for initial webhook test verification)
    if (event === 'ping') {
      return NextResponse.json({
        ok: true,
        message: 'Pong! Kylrix GitHub webhook receiver active.',
        zen: payload.zen,
        hookId: payload.hook_id,
        delivery,
      });
    }

    return NextResponse.json({
      received: true,
      event,
      action: action || null,
      repo: repoFullName,
      delivery,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logError('[github-webhook] Ingestion error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/github/webhook',
    message: 'Kylrix GitHub Webhook Ingestion Endpoint',
  });
}
