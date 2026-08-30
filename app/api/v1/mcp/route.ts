import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRpc } from '@/lib/mcp/handler';
import { createSseStream } from '@/lib/mcp/sse';
import { EdgeShieldError } from '@/lib/api/edge-shield';
import { MAX_API_BODY_BYTES } from '@/lib/api/guard';
import { MCP_SSE_ENDPOINT } from '@/lib/mcp/sse';
import { KYLRIX_MCP_VERSION } from '@/lib/mcp/types';
import { getProductName, getProductSiteUrl } from '@/lib/config/product';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function mcpShieldResponse(err: EdgeShieldError) {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32029,
        message: err.message,
        data: { reason: err.reason, retry_after: err.retryAfterSec },
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(err.retryAfterSec) },
    },
  );
}

export async function GET(req: NextRequest) {
  const acceptHeader = req.headers.get('accept') || '';
  const isSse = acceptHeader.includes('text/event-stream') || req.nextUrl.searchParams.get('transport') === 'sse';

  if (isSse) {
    try {
      return createSseStream(req, MCP_SSE_ENDPOINT);
    } catch (err) {
      if (err instanceof EdgeShieldError) return mcpShieldResponse(err);
      throw err;
    }
  }

  // If accessed via regular browser GET, return discovery info
  return NextResponse.json({
    name: getProductName().toLowerCase().replace(/\s+/g, '-'),
    displayName: getProductName(),
    description: `${getProductName()} Model Context Protocol (MCP) Server — Connect agents and LLMs to sovereign workspaces, notes, goals, calendar events, forms, flows, chats, and vault objects.`,
    version: KYLRIX_MCP_VERSION,
    homepage: getProductSiteUrl(),
    iconUrl: `${getProductSiteUrl()}/apple-touch-icon.png`,
    protocol: '2024-11-05',
    endpoints: {
      sse: `${MCP_SSE_ENDPOINT}?transport=sse`,
      http: MCP_SSE_ENDPOINT,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const cl = Number(req.headers.get('content-length') || 0);
    if (cl > MAX_API_BODY_BYTES) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32602, message: 'Payload too large (maximum 256 KB)' },
        },
        { status: 413 },
      );
    }

    const body = await req.json();
    const result = await handleMcpRpc(req, body);
    const httpStatus = result.httpStatus ?? (result.body === null ? 204 : 200);
    if (result.body === null) {
      return new Response(null, { status: httpStatus });
    }
    const headers: Record<string, string> = {};
    if (httpStatus === 429) {
      const retry = (result.body?.error?.data?.retry_after as number) || 60;
      headers['Retry-After'] = String(retry);
    }
    return NextResponse.json(result.body, { status: httpStatus, headers });
  } catch (err: any) {
    if (err instanceof EdgeShieldError) return mcpShieldResponse(err);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: err?.message || 'Parse error / Invalid JSON-RPC payload',
        },
      },
      { status: 400 },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    },
  });
}
