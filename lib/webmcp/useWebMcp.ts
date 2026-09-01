'use client';

import { useEffect, useState, useCallback } from 'react';
import { webMcpRegistry } from './registry';
import { KYLRIX_WEBMCP_TOOLS } from './tools';
import type {
  WebMcpToolDefinition,
  WebMcpToolExecutionEvent,
  WebMcpToolExecutionResult,
} from './types';

/**
 * Hook to interact with the WebMCP subsystem:
 * - Access registered browser tools
 * - Register dynamic or page-scoped tools with automatic cleanup on unmount
 * - Trigger tools in the live browser context
 * - Stream execution logs & events
 */
export function useWebMcp(options?: {
  dynamicTools?: WebMcpToolDefinition[];
  autoRegisterDefault?: boolean;
}) {
  const [tools, setTools] = useState<WebMcpToolDefinition[]>([]);
  const [history, setHistory] = useState<WebMcpToolExecutionEvent[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize polyfill and default tools
    webMcpRegistry.init();
    if (options?.autoRegisterDefault !== false) {
      webMcpRegistry.registerTools(KYLRIX_WEBMCP_TOOLS);
    }

    // Register any component-provided dynamic tools
    if (options?.dynamicTools && options.dynamicTools.length > 0) {
      webMcpRegistry.registerTools(options.dynamicTools);
    }

    setIsReady(true);

    const unsubTools = webMcpRegistry.onToolsChange((updatedTools) => {
      setTools(updatedTools);
    });

    const unsubHistory = webMcpRegistry.onHistoryChange((updatedHistory) => {
      setHistory(updatedHistory);
    });

    return () => {
      unsubTools();
      unsubHistory();
      if (options?.dynamicTools) {
        for (const tool of options.dynamicTools) {
          webMcpRegistry.unregisterTool(tool.name);
        }
      }
    };
  }, [options?.dynamicTools, options?.autoRegisterDefault]);

  const executeTool = useCallback(
    async (
      name: string,
      args: Record<string, any> = {},
      origin: WebMcpToolExecutionEvent['origin'] = 'inspector'
    ): Promise<WebMcpToolExecutionResult> => {
      return await webMcpRegistry.executeTool(name, args, origin);
    },
    []
  );

  const clearLogs = useCallback(() => {
    webMcpRegistry.clearHistory();
  }, []);

  return {
    isReady,
    tools,
    history,
    executeTool,
    clearLogs,
    registerTool: (tool: WebMcpToolDefinition) => webMcpRegistry.registerTool(tool),
    unregisterTool: (name: string) => webMcpRegistry.unregisterTool(name),
  };
}
