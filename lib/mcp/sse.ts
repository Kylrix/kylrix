import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRpc } from './handler';

type SseSession = {
  id: string;
  controller: ReadableStreamDefaultController;
  createdAt: number;
};

const activeSessions = new Map<string, SseSession>();

// Cleanup stale sessions after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt > 3600 * 1000) {
      try {
        session.controller.close();
      } catch {}
      activeSessions.delete(id);
    }
  }
}, 60 * 1000);

export function createSseStream(req: NextRequest, endpointPrefix = '/api/v1/mcp'): Response {
  const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const stream = new ReadableStream({
    start(controller) {
      activeSessions.set(sessionId, {
        id: sessionId,
        controller,
        createdAt: Date.now(),
      });

      const messageEndpoint = `${endpointPrefix}/messages?sessionId=${sessionId}`;
      const initialPayload = `event: endpoint\ndata: ${messageEndpoint}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialPayload));
    },
    cancel() {
      activeSessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export async function handleSseMessagePost(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }

  const rpcResponse = await handleMcpRpc(req, body);

  if (sessionId && activeSessions.has(sessionId) && rpcResponse) {
    const session = activeSessions.get(sessionId)!;
    try {
      const ssePayload = `event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`;
      session.controller.enqueue(new TextEncoder().encode(ssePayload));
    } catch {
      activeSessions.delete(sessionId);
    }
  }

  // Also return 200/202 with JSON for dual compatibility
  if (rpcResponse === null) {
    return new Response(null, { status: 204 });
  }
  return NextResponse.json(rpcResponse);
}
