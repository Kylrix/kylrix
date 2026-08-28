import { MCP_TOOLS, executeMcpTool } from '@/lib/mcp/handler';
import { PAT_SCOPES } from '@/lib/api/scopes';
import type { ApiActor } from '@/lib/api/guard';

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const McpServerService = {
  /**
   * Discovers tools registered on the native Kylrix MCP server.
   */
  async listTools(): Promise<{ ok: boolean; tools?: McpToolDefinition[]; error?: string }> {
    try {
      const tools: McpToolDefinition[] = MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return { ok: true, tools };
    } catch (err: any) {
      console.error('[McpServerService.listTools]', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Executes a specific tool on the native Kylrix MCP server.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    actor?: ApiActor
  ): Promise<{ ok: boolean; content?: any[]; error?: string }> {
    try {
      const systemActor: ApiActor = actor || {
        userId: 'system',
        kind: 'session',
        scopes: [...PAT_SCOPES],
      };

      const result = await executeMcpTool(systemActor, name, args);
      return {
        ok: true,
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      console.error('[McpServerService.callTool]', err);
      return { ok: false, error: err?.message || 'Tool execution failed' };
    }
  },
};
