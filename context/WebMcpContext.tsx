'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { webMcpRegistry } from '@/lib/webmcp/registry';
import { KYLRIX_WEBMCP_TOOLS } from '@/lib/webmcp/tools';
import type {
  WebMcpToolDefinition,
  WebMcpToolExecutionEvent,
  WebMcpToolExecutionResult,
} from '@/lib/webmcp/types';

interface WebMcpContextType {
  isInitialized: boolean;
  tools: WebMcpToolDefinition[];
  executionHistory: WebMcpToolExecutionEvent[];
  isInspectorOpen: boolean;
  openInspector: () => void;
  closeInspector: () => void;
  toggleInspector: () => void;
  executeTool: (name: string, args?: Record<string, any>) => Promise<WebMcpToolExecutionResult>;
  clearHistory: () => void;
}

const WebMcpContext = createContext<WebMcpContextType | undefined>(undefined);

export function WebMcpProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [tools, setTools] = useState<WebMcpToolDefinition[]>([]);
  const [executionHistory, setExecutionHistory] = useState<WebMcpToolExecutionEvent[]>([]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  useEffect(() => {
    // 1. Initialize Polyfill & Browser Context
    webMcpRegistry.init();

    // 2. Register standard Kylrix tool catalog
    webMcpRegistry.registerTools(KYLRIX_WEBMCP_TOOLS);
    setIsInitialized(true);

    // 3. Subscribe to registry state updates
    const unsubTools = webMcpRegistry.onToolsChange((updatedTools) => {
      setTools(updatedTools);
    });

    const unsubHistory = webMcpRegistry.onHistoryChange((updatedHistory) => {
      setExecutionHistory(updatedHistory);
    });

    const handleOpen = () => setIsInspectorOpen(true);
    const handleToggle = () => setIsInspectorOpen((prev) => !prev);
    if (typeof window !== 'undefined') {
      window.addEventListener('kylrix:open-webmcp', handleOpen);
      window.addEventListener('kylrix:toggle-webmcp', handleToggle);
    }

    return () => {
      unsubTools();
      unsubHistory();
      if (typeof window !== 'undefined') {
        window.removeEventListener('kylrix:open-webmcp', handleOpen);
        window.removeEventListener('kylrix:toggle-webmcp', handleToggle);
      }
    };
  }, []);

  const openInspector = () => setIsInspectorOpen(true);
  const closeInspector = () => setIsInspectorOpen(false);
  const toggleInspector = () => setIsInspectorOpen((prev) => !prev);

  const executeTool = async (name: string, args: Record<string, any> = {}) => {
    return await webMcpRegistry.executeTool(name, args, 'inspector');
  };

  const clearHistory = () => {
    webMcpRegistry.clearHistory();
  };

  return (
    <WebMcpContext.Provider
      value={{
        isInitialized,
        tools,
        executionHistory,
        isInspectorOpen,
        openInspector,
        closeInspector,
        toggleInspector,
        executeTool,
        clearHistory,
      }}
    >
      {children}
    </WebMcpContext.Provider>
  );
}

export function useWebMcpContext() {
  const context = useContext(WebMcpContext);
  if (!context) {
    throw new Error('useWebMcpContext must be used within a WebMcpProvider');
  }
  return context;
}
