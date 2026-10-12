/**
 * WebMCP Central Registry & Dispatch Engine for Kylrix
 */

import { ensureWebMcpPolyfill } from './polyfill';
import type {
  ModelContext,
  WebMcpToolDefinition,
  WebMcpToolExecutionEvent,
  WebMcpToolExecutionResult,
} from './types';

class WebMcpRegistry {
  private static instance: WebMcpRegistry;
  private tools: Map<string, WebMcpToolDefinition> = new Map();
  private executionHistory: WebMcpToolExecutionEvent[] = [];
  private historyListeners: Set<(history: WebMcpToolExecutionEvent[]) => void> = new Set();
  private toolsListeners: Set<(tools: WebMcpToolDefinition[]) => void> = new Set();
  private context: ModelContext | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): WebMcpRegistry {
    if (!WebMcpRegistry.instance) {
      WebMcpRegistry.instance = new WebMcpRegistry();
    }
    return WebMcpRegistry.instance;
  }

  public init(): ModelContext {
    if (this.initialized && this.context) {
      return this.context;
    }
    this.context = ensureWebMcpPolyfill();
    this.initialized = true;
    return this.context;
  }

  public registerTool(tool: WebMcpToolDefinition): void {
    const ctx = this.init();
    this.tools.set(tool.name, tool);
    ctx.registerTool(tool);
    this.notifyToolsChanged();
  }

  public registerTools(tools: WebMcpToolDefinition[]): void {
    const ctx = this.init();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
      ctx.registerTool(tool);
    }
    this.notifyToolsChanged();
  }

  public unregisterTool(toolName: string): void {
    if (this.tools.has(toolName)) {
      this.tools.delete(toolName);
      this.context?.unregisterTool(toolName);
      this.notifyToolsChanged();
    }
  }

  public getTools(): WebMcpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): WebMcpToolDefinition | undefined {
    return this.tools.get(name);
  }

  public async executeTool(
    name: string,
    args: Record<string, any> = {},
    origin: WebMcpToolExecutionEvent['origin'] = 'internal'
  ): Promise<WebMcpToolExecutionResult> {
    const tool = this.tools.get(name);
    const start = performance.now();
    const eventId = 'exec_' + Math.random().toString(36).slice(2, 10);

    if (!tool) {
      const errRes: WebMcpToolExecutionResult = {
        isError: true,
        content: [{ type: 'text', text: `Tool '${name}' not found in WebMCP registry.` }],
      };
      this.recordExecution({
        id: eventId,
        toolName: name,
        args,
        result: errRes,
        error: `Tool '${name}' not found`,
        timestamp: Date.now(),
        durationMs: Math.round(performance.now() - start),
        origin,
      });
      return errRes;
    }

    try {
      const rawRes = await tool.execute(args);
      let formattedRes: WebMcpToolExecutionResult;

      if (typeof rawRes === 'string') {
        formattedRes = {
          isError: false,
          content: [{ type: 'text', text: rawRes }],
        };
      } else if (rawRes && Array.isArray((rawRes as any).content)) {
        formattedRes = rawRes as WebMcpToolExecutionResult;
      } else {
        formattedRes = {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(rawRes, null, 2) }],
          meta: rawRes,
        };
      }

      this.recordExecution({
        id: eventId,
        toolName: name,
        args,
        result: formattedRes,
        timestamp: Date.now(),
        durationMs: Math.round(performance.now() - start),
        origin,
      });

      return formattedRes;
    } catch (err: any) {
      const errRes: WebMcpToolExecutionResult = {
        isError: true,
        content: [{ type: 'text', text: `Execution failed: ${err?.message || String(err)}` }],
      };
      this.recordExecution({
        id: eventId,
        toolName: name,
        args,
        result: errRes,
        error: err?.message || String(err),
        timestamp: Date.now(),
        durationMs: Math.round(performance.now() - start),
        origin,
      });
      return errRes;
    }
  }

  public getHistory(): WebMcpToolExecutionEvent[] {
    return this.executionHistory;
  }

  public clearHistory(): void {
    this.executionHistory = [];
    this.notifyHistoryChanged();
  }

  public onToolsChange(cb: (tools: WebMcpToolDefinition[]) => void): () => void {
    this.toolsListeners.add(cb);
    cb(this.getTools());
    return () => this.toolsListeners.delete(cb);
  }

  public onHistoryChange(cb: (history: WebMcpToolExecutionEvent[]) => void): () => void {
    this.historyListeners.add(cb);
    cb(this.getHistory());
    return () => this.historyListeners.delete(cb);
  }

  private recordExecution(event: WebMcpToolExecutionEvent): void {
    this.executionHistory.unshift(event);
    if (this.executionHistory.length > 100) {
      this.executionHistory.pop();
    }
    this.notifyHistoryChanged();
  }

  private notifyToolsChanged(): void {
    const list = this.getTools();
    for (const listener of this.toolsListeners) {
      try {
        listener(list);
      } catch (e) {
        console.error('[WebMCP] Tools listener error:', e);
      }
    }
  }

  private notifyHistoryChanged(): void {
    const hist = this.getHistory();
    for (const listener of this.historyListeners) {
      try {
        listener(hist);
      } catch (e) {
        console.error('[WebMCP] History listener error:', e);
      }
    }
  }
}

export const webMcpRegistry = WebMcpRegistry.getInstance();
