import { NextRequest } from 'next/server';
import { resolveApiActor, type ApiActor } from '@/lib/api/guard';
import { RateLimitError } from '@/lib/api/rate-limits';
import { EdgeShieldError, assertShieldAllowed, enforceMcpPublicShield } from '@/lib/api/edge-shield';
import { executeMcpTool } from '@/lib/mcp/dispatch';
import { MCP_TOOLS } from '@/lib/mcp/tools';
import { getProductName, getProductSiteUrl } from '@/lib/config/product';

export { executeMcpTool } from '@/lib/mcp/dispatch';
export { MCP_TOOLS } from '@/lib/mcp/tools';
export type { McpTool, McpToolAnnotation } from '@/lib/mcp/types';

const MCP_PUBLIC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'initialized',
  'ping',
  'tools/list',
  'resources/list',
  'prompts/list',
]);

function mcpJsonRpcError(id: unknown, code: number, message: string, data?: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function mapGuardErrorToMcp(err: unknown, id: unknown) {
  if (err instanceof RateLimitError || (err as any)?.code === 'rate_limit_exceeded') {
    return {
      httpStatus: 429,
      body: mcpJsonRpcError(id, -32029, (err as Error).message, {
        type: (err as RateLimitError).type,
        retry_after: (err as RateLimitError).retryAfterSec,
      }),
    };
  }
  if (err instanceof EdgeShieldError || (err as any)?.code === 'edge_rate_limited') {
    return {
      httpStatus: 429,
      body: mcpJsonRpcError(id, -32029, (err as Error).message, {
        reason: (err as EdgeShieldError).reason,
        retry_after: (err as EdgeShieldError).retryAfterSec,
      }),
    };
  }
  const status = (err as any)?.status;
  if (status === 401) {
    return { httpStatus: 401, body: mcpJsonRpcError(id, -32001, (err as Error).message || 'Unauthorized') };
  }
  if (status === 413) {
    return { httpStatus: 413, body: mcpJsonRpcError(id, -32602, (err as Error).message || 'Payload too large') };
  }
  return null;
}

export type McpRpcResult =
  | { httpStatus: number; body: any }
  | { httpStatus?: number; body: any | null };

export async function handleMcpRpc(req: NextRequest, rpcPayload: any): Promise<McpRpcResult> {
  const { id, method, params } = rpcPayload || {};

  if (MCP_PUBLIC_METHODS.has(method)) {
    assertShieldAllowed(enforceMcpPublicShield(req));
  }

  // Handshake methods that can execute without strict authentication
  if (method === 'initialize') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: getProductName().toLowerCase().replace(/\s+/g, '-'),
            displayName: getProductName(),
            description: 'Sovereign, local-first agentic workspace MCP server',
            version: '1.0.0',
            homepage: getProductSiteUrl(),
            iconUrl: `${getProductSiteUrl()}/apple-touch-icon.png`,
          },
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return { body: null }; // Notifications produce no response
  }

  if (method === 'ping') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {},
      },
    };
  }

  if (method === 'tools/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          tools: MCP_TOOLS,
        },
      },
    };
  }

  if (method === 'resources/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          resources: [],
        },
      },
    };
  }

  if (method === 'prompts/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          prompts: [],
        },
      },
    };
  }

  // Tool execution requires authenticated actor
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      let actor: ApiActor;
      try {
        actor = await resolveApiActor(req);
      } catch (authErr) {
        const mapped = mapGuardErrorToMcp(authErr, id);
        if (mapped) return mapped;
        if (toolName === 'list_available_scopes') {
          const { listScopeCatalog } = await import('@/lib/api/scopes');
          return {
            body: {
              jsonrpc: '2.0',
              id: id ?? null,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ scopes: listScopeCatalog() }, null, 2),
                  },
                ],
                isError: false,
              },
            },
          };
        }
        throw authErr;
      }

      const toolResult = await executeMcpTool(actor, toolName, toolArgs);

      return {
        body: {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: false,
          },
        },
      };
    } catch (err: any) {
      const mapped = mapGuardErrorToMcp(err, id);
      if (mapped) return mapped;
      return {
        body: {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: err?.message || 'Tool execution failed' }),
              },
            ],
            isError: true,
          },
        },
      };
    }
  }

  return {
    body: {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    },
  };
}
