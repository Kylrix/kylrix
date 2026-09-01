/**
 * WebMCP Browser Polyfill & Bridge
 * Provides navigator.modelContext & document.modelContext conforming to W3C WebMCP.
 */

import type { ModelContext, WebMcpToolDefinition, WebMcpToolExecutionResult } from './types';

class WebMcpModelContextImpl implements ModelContext {
  private tools: Map<string, WebMcpToolDefinition> = new Map();
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  async registerTool(tool: WebMcpToolDefinition): Promise<void> {
    if (!tool || !tool.name) {
      throw new Error('WebMCP: Invalid tool definition. "name" is required.');
    }
    this.tools.set(tool.name, tool);
    this.emit('toolregistered', { name: tool.name, tool });
    this.emit('toolschanged', { tools: Array.from(this.tools.values()) });

    // Inform window for any external agent observers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('webmcp:tool-registered', {
          detail: { toolName: tool.name, description: tool.description },
        })
      );
    }
  }

  async unregisterTool(toolName: string): Promise<void> {
    if (this.tools.has(toolName)) {
      this.tools.delete(toolName);
      this.emit('toolunregistered', { name: toolName });
      this.emit('toolschanged', { tools: Array.from(this.tools.values()) });
    }
  }

  async listTools(): Promise<WebMcpToolDefinition[]> {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: Record<string, any> = {}): Promise<WebMcpToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Error: Tool '${name}' is not registered.` }],
      };
    }

    try {
      const rawRes = await tool.execute(args);
      if (typeof rawRes === 'string') {
        return {
          isError: false,
          content: [{ type: 'text', text: rawRes }],
        };
      }
      if (rawRes && Array.isArray((rawRes as any).content)) {
        return rawRes as WebMcpToolExecutionResult;
      }
      return {
        isError: false,
        content: [{ type: 'text', text: JSON.stringify(rawRes, null, 2) }],
        meta: rawRes,
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Execution Error (${name}): ${err?.message || String(err)}` }],
      };
    }
  }

  addEventListener(event: string, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener);
  }

  removeEventListener(event: string, listener: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (e) {
          console.error('[WebMCP] Event listener error:', e);
        }
      }
    }
  }
}

export function ensureWebMcpPolyfill(): ModelContext {
  if (typeof window === 'undefined') {
    return new WebMcpModelContextImpl();
  }

  // If already initialized, return existing
  if ((window as any).__KYLRIX_WEBMCP_CONTEXT__) {
    return (window as any).__KYLRIX_WEBMCP_CONTEXT__;
  }

  // Check if browser has native navigator.modelContext or document.modelContext
  const nativeCtx = (navigator as any).modelContext || (document as any).modelContext;
  const contextInstance = new WebMcpModelContextImpl();

  // If native exists, wrap it so native tools get merged/forwarded
  if (nativeCtx && typeof nativeCtx.registerTool === 'function') {
    const originalRegister = contextInstance.registerTool.bind(contextInstance);
    contextInstance.registerTool = async (tool: WebMcpToolDefinition) => {
      await originalRegister(tool);
      try {
        await nativeCtx.registerTool(tool);
      } catch (err) {
        console.warn('[WebMCP] Native modelContext register error (fallback used):', err);
      }
    };
  }

  // Mount on navigator and document for standard WebMCP discovery
  try {
    Object.defineProperty(navigator, 'modelContext', {
      value: contextInstance,
      writable: true,
      configurable: true,
    });
  } catch {
    (navigator as any).modelContext = contextInstance;
  }

  try {
    Object.defineProperty(document, 'modelContext', {
      value: contextInstance,
      writable: true,
      configurable: true,
    });
  } catch {
    (document as any).modelContext = contextInstance;
  }

  (window as any).__KYLRIX_WEBMCP_CONTEXT__ = contextInstance;
  (window as any).__KYLRIX_WEBMCP_INITIALIZED__ = true;

  // Dispatch standard ready event
  window.dispatchEvent(new CustomEvent('webmcp:ready', { detail: { context: contextInstance } }));

  return contextInstance;
}
