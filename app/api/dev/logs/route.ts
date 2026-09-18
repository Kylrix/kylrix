import { NextRequest, NextResponse } from 'next/server';
import { devLogStreamer, DevLogEntry } from '@/lib/dev/live-logs';
import { canExposeLiveErrorsForEmail } from '@/lib/services/internal/engineer-guard';
import { getActor } from '@/lib/actions/secure-ops/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAllowed(req: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') {
    const host = req.headers.get('host') || '';
    const ip = req.headers.get('x-forwarded-for') || '';
    if (
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      process.env.NODE_ENV === 'development'
    ) {
      return true;
    }
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const actor = await getActor(jwt).catch(() => null);
    if (actor?.email && canExposeLiveErrorsForEmail(actor.email)) {
      return true;
    }
  } catch {}

  return false;
}

export async function GET(req: NextRequest) {
  if (!(await isAllowed(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isStream = req.nextUrl.searchParams.get('stream') === 'true' || req.headers.get('accept') === 'text/event-stream';
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 100)));
  const level = req.nextUrl.searchParams.get('level') || undefined;

  if (isStream) {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial backlog
        const initial = devLogStreamer.getRecentLogs(limit, level);
        for (const log of initial) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`));
        }

        // Subscribe to live logs
        unsubscribe = devLogStreamer.subscribe((entry) => {
          if (level && entry.level !== level) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
          } catch {
            if (unsubscribe) unsubscribe();
          }
        });
      },
      cancel() {
        if (unsubscribe) unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  const logs = devLogStreamer.getRecentLogs(limit, level);
  return NextResponse.json({ ok: true, count: logs.length, logs });
}

export async function POST(req: NextRequest) {
  if (!(await isAllowed(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const entry: DevLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: body.level === 'warn' ? 'warn' : body.level === 'info' ? 'info' : 'error',
    message,
    stack: body.stack ? String(body.stack) : undefined,
    source: 'client',
  };

  devLogStreamer.addEntry(entry);
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAllowed(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  devLogStreamer.clear();
  return NextResponse.json({ ok: true, cleared: true });
}
