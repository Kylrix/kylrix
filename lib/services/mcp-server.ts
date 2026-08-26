import { createSystemFunctions } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const McpServerService = {
  /**
   * Discovers tools registered on the Kylrix MCP server.
   */
  async listTools(): Promise<{ ok: boolean; tools?: McpToolDefinition[]; error?: string }> {
    try {
      const functions = createSystemFunctions();
      const functionId = APPWRITE_CONFIG.FUNCTIONS.MCP_SERVER || '6a8f212e003d1f3518db';

      const execution = await functions.createExecution(
        functionId,
        JSON.stringify({ method: 'tools/list' }),
        false
      );

      const resBody = execution.responseBody ? JSON.parse(execution.responseBody) : {};
      return { ok: execution.responseStatusCode < 400 && !resBody.isError, tools: resBody.tools, error: resBody.error };
    } catch (err: any) {
      console.error('[McpServerService.listTools]', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Executes a specific tool on the Kylrix MCP server.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<{ ok: boolean; content?: any[]; error?: string }> {
    try {
      const functions = createSystemFunctions();
      const functionId = APPWRITE_CONFIG.FUNCTIONS.MCP_SERVER || '6a8f212e003d1f3518db';

      const execution = await functions.createExecution(
        functionId,
        JSON.stringify({
          method: 'tools/call',
          params: { name, arguments: args },
        }),
        false
      );

      const resBody = execution.responseBody ? JSON.parse(execution.responseBody) : {};
      return { ok: execution.responseStatusCode < 400 && !resBody.isError, content: resBody.content, error: resBody.error };
    } catch (err: any) {
      console.error('[McpServerService.callTool]', err);
      return { ok: false, error: err.message };
    }
  },
};
