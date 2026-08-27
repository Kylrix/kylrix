import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRpc } from '@/lib/mcp/handler';
import { createSseStream } from '@/lib/mcp/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const acceptHeader = req.headers.get('accept') || '';
  const isSse = acceptHeader.includes('text/event-stream') || req.nextUrl.searchParams.get('transport') === 'sse';

  if (isSse) {
    return createSseStream(req, '/api/v1/mcp');
  }

  // If accessed via regular browser GET, return discovery info
  return NextResponse.json({
    name: 'kylrix',
    displayName: 'Kylrix',
    description: 'Kylrix Model Context Protocol (MCP) Server — Connect agents and LLMs to sovereign workspaces, notes, goals, calendar events, forms, flows, chats, and vault objects.',
    version: '1.0.0',
    homepage: 'https://www.kylrix.space',
    iconUrl: 'https://www.kylrix.space/apple-touch-icon.png',
    protocol: '2024-11-05',
    endpoints: {
      sse: '/api/v1/mcp?transport=sse',
      http: '/api/v1/mcp',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await handleMcpRpc(req, body);
    if (result === null) {
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: err?.message || 'Parse error / Invalid JSON-RPC payload',
        },
      },
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
