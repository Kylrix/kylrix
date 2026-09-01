/**
 * WebMCP (Web Model Context Protocol) Type Definitions
 * Conforms to the emerging W3C WebMCP standard and browser navigator.modelContext API.
 */

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: string[] | number[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: any;
  [key: string]: any;
}

export interface JsonSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  additionalProperties?: boolean;
  [key: string]: any;
}

export interface WebMcpToolContent {
  type: 'text' | 'image' | 'resource' | 'json';
  text?: string;
  data?: any;
  mimeType?: string;
}

export interface WebMcpToolExecutionResult {
  content: WebMcpToolContent[];
  isError?: boolean;
  meta?: Record<string, any>;
}

export interface WebMcpToolDefinition<TArgs = Record<string, any>> {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (args: TArgs) => Promise<WebMcpToolExecutionResult | Record<string, any> | string>;
  category?: 'notes' | 'goals' | 'workspaces' | 'flows' | 'events' | 'forms' | 'chat' | 'navigation' | 'system';
}

export interface WebMcpToolExecutionEvent {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: WebMcpToolExecutionResult;
  error?: string;
  timestamp: number;
  durationMs: number;
  origin: 'native-browser' | 'chatgpt' | 'agent' | 'inspector' | 'internal';
}

export interface ModelContext {
  registerTool: (tool: WebMcpToolDefinition) => void | Promise<void>;
  unregisterTool: (toolName: string) => void | Promise<void>;
  listTools?: () => WebMcpToolDefinition[] | Promise<WebMcpToolDefinition[]>;
  executeTool?: (name: string, args: Record<string, any>) => Promise<WebMcpToolExecutionResult>;
  addEventListener?: (event: string, listener: (...args: any[]) => void) => void;
  removeEventListener?: (event: string, listener: (...args: any[]) => void) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
  interface Document {
    modelContext?: ModelContext;
  }
  interface Window {
    __KYLRIX_WEBMCP_INITIALIZED__?: boolean;
  }
}
