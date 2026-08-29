import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRpc } from './handler';
import {
  assertShieldAllowed,
  enforceMcpSseOpenShield,
  getClientIp,
  EdgeShieldError,
} from '@/lib/api/edge-shield';
import { MAX_API_BODY_BYTES } from '@/lib/api/guard';

type SseSession = {
  id: string;
  controller: ReadableStreamDefaultController;
  createdAt: number;
  clientIp: string;
};

const activeSessions = new Map<string, SseSession>();
const sessionsPerIp = new Map<string, Set<string>>();
const MAX_SSE_SESSIONS_PER_IP = 5;

function releaseSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  activeSessions.delete(sessionId);
  if (!session?.clientIp) return;
  const set = sessionsPerIp.get(session.clientIp);
  if (!set) return;
  set.delete(sessionId);
  if (!set.size) sessionsPerIp.delete(session.clientIp);
}

// Cleanup stale sessions after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt > 3600 * 1000) {
      try {
        session.controller.close();
      } catch {}
      releaseSession(id);
    }
  }
}, 60 * 1000);

export function createSseStream(req: NextRequest, endpointPrefix = '/api/v1/mcp'): Response {
  assertShieldAllowed(enforceMcpSseOpenShield(req));
  const clientIp = getClientIp(req);
  const ipSessions = sessionsPerIp.get(clientIp);
  if (ipSessions && ipSessions.size >= MAX_SSE_SESSIONS_PER_IP) {
    throw new EdgeShieldError({
      allowed: false,
      retryAfterSec: 120,
      reason: 'quota',
      tier: `mcp_sse_cap:${clientIp}`,
    });
  }

  const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const stream = new ReadableStream({
    start(controller) {
      activeSessions.set(sessionId, {
        id: sessionId,
        controller,
        createdAt: Date.now(),
        clientIp,
      });
      if (!sessionsPerIp.has(clientIp)) sessionsPerIp.set(clientIp, new Set());
      sessionsPerIp.get(clientIp)!.add(sessionId);

      const messageEndpoint = `${endpointPrefix}/messages?sessionId=${sessionId}`;
      const initialPayload = `event: endpoint\ndata: ${messageEndpoint}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialPayload));
    },
    cancel() {
      releaseSession(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    },
  });
}

export async function handleSseMessagePost(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  const cl = Number(req.headers.get('content-length') || 0);
  if (cl > MAX_API_BODY_BYTES) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32602, message: 'Payload too large (maximum 256 KB)' } },
      { status: 413 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }

  try {
    const rpcResult = await handleMcpRpc(req, body);
    const httpStatus = rpcResult.httpStatus ?? (rpcResult.body === null ? 204 : 200);

    if (sessionId && activeSessions.has(sessionId) && rpcResult.body) {
      const session = activeSessions.get(sessionId)!;
      try {
        const ssePayload = `event: message\ndata: ${JSON.stringify(rpcResult.body)}\n\n`;
        session.controller.enqueue(new TextEncoder().encode(ssePayload));
      } catch {
        releaseSession(sessionId);
      }
    }

    if (rpcResult.body === null) {
      return new Response(null, { status: httpStatus });
    }

    const headers: Record<string, string> = {};
    if (httpStatus === 429) {
      headers['Retry-After'] = String(rpcResult.body?.error?.data?.retry_after || 60);
    }
    return NextResponse.json(rpcResult.body, { status: httpStatus, headers });
  } catch (err) {
    if (err instanceof EdgeShieldError) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body?.id ?? null,
          error: {
            code: -32029,
            message: err.message,
            data: { reason: err.reason, retry_after: err.retryAfterSec },
          },
        },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSec) } },
      );
    }
    throw err;
  }
}
