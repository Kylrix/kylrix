import * as readline from 'node:readline';
import { getClient } from '../client';
import { resolveEnvironment } from '../config';
import { MCP_TOOL_ENTRIES } from '@/lib/mcp/tool-catalog';

export async function runStdioMcpServer(opts: { url?: string; token?: string; workspace?: string }) {
  const client = getClient(opts);
  const env = resolveEnvironment(opts);

  // Stdio transport: read from stdin, write to stdout
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const sendResponse = (response: any) => {
    process.stdout.write(JSON.stringify(response) + '\n');
  };

  const sendError = (id: string | number | null, code: number, message: string, data?: any) => {
    sendResponse({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message, data },
    });
  };

  // Log diagnostics to stderr (never stdout to avoid corrupting JSON-RPC)
  console.error('[kylrix-mcp] Starting Kylrix Model Context Protocol stdio server...');

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req: any;
    try {
      req = JSON.parse(trimmed);
    } catch {
      sendError(null, -32700, 'Parse error: Invalid JSON');
      return;
    }

    const { id, method, params } = req;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        console.error('[kylrix-mcp] Initialized notification received.');
      }
      return;
    }

    try {
      switch (method) {
        case 'initialize': {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'kylrix',
                version: '1.0.0',
              },
            },
          });
          break;
        }

        case 'ping': {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {},
          });
          break;
        }

        case 'tools/list': {
          const tools = MCP_TOOL_ENTRIES.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));

          sendResponse({
            jsonrpc: '2.0',
            id,
            result: { tools },
          });
          break;
        }

        case 'tools/call': {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};

          if (!toolName) {
            sendError(id, -32602, 'Invalid params: tool name required');
            return;
          }

          try {
            const rawResult = await client.mcp.callTool(toolName, toolArgs);
            const resultData = (rawResult as any)?.result || rawResult;

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: typeof resultData === 'string' ? resultData : JSON.stringify(resultData, null, 2),
                  },
                ],
                isError: false,
              },
            });
          } catch (toolErr: any) {
            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: toolErr?.message || String(toolErr),
                  },
                ],
                isError: true,
              },
            });
          }
          break;
        }

        default: {
          sendError(id, -32601, `Method not found: ${method}`);
          break;
        }
      }
    } catch (err: any) {
      sendError(id, -32603, `Internal error: ${err.message}`);
    }
  });

  process.on('SIGINT', () => {
    console.error('[kylrix-mcp] Shutting down stdio server...');
    process.exit(0);
  });
}
