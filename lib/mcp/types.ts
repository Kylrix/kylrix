/** MCP server semantic version (initialize + discovery GET). */
export const KYLRIX_MCP_VERSION = '1.0.1';

export interface McpToolAnnotation {
  audience?: Array<'user' | 'assistant'>;
  readOnly?: boolean;
  idempotent?: boolean;
  destructive?: boolean;
  priority?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: readonly string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    description?: string;
  };
  annotations?: McpToolAnnotation;
}

/** Small helper to keep MCP tool entries readable in the catalog file. */
export function defineMcpTool(tool: McpTool): McpTool {
  return tool;
}
