'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AgenticDrawerOpenOptions {
  prompt?: string;
  autoRun?: boolean;
}

interface AgenticDrawerContextValue {
  isOpen: boolean;
  pendingPrompt: string | null;
  pendingAutoRun: boolean;
  openAgenticDrawer: (options?: AgenticDrawerOpenOptions) => void;
  closeAgenticDrawer: () => void;
  consumePendingPrompt: () => { prompt: string; autoRun: boolean } | null;
}

const AgenticDrawerContext = createContext<AgenticDrawerContextValue | undefined>(undefined);

export function AgenticDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [pendingAutoRun, setPendingAutoRun] = useState(false);

  const openAgenticDrawer = useCallback((options?: AgenticDrawerOpenOptions) => {
    if (options?.prompt) {
      setPendingPrompt(options.prompt);
      setPendingAutoRun(Boolean(options.autoRun));
    }
    setIsOpen(true);
  }, []);

  const closeAgenticDrawer = useCallback(() => {
    setIsOpen(false);
    setPendingPrompt(null);
    setPendingAutoRun(false);
  }, []);

  const consumePendingPrompt = useCallback(() => {
    if (!pendingPrompt) return null;
    const payload = { prompt: pendingPrompt, autoRun: pendingAutoRun };
    setPendingPrompt(null);
    setPendingAutoRun(false);
    return payload;
  }, [pendingAutoRun, pendingPrompt]);

  const value = useMemo<AgenticDrawerContextValue>(
    () => ({
      isOpen,
      pendingPrompt,
      pendingAutoRun,
      openAgenticDrawer,
      closeAgenticDrawer,
      consumePendingPrompt}),
    [consumePendingPrompt, isOpen, openAgenticDrawer, closeAgenticDrawer, pendingAutoRun, pendingPrompt],
  );

  return <AgenticDrawerContext.Provider value={value}>{children}</AgenticDrawerContext.Provider>;
}

export function useAgenticDrawer() {
  const context = useContext(AgenticDrawerContext);
  if (!context) {
    return {
      isOpen: false,
      pendingPrompt: null,
      pendingAutoRun: false,
      openAgenticDrawer: () => {},
      closeAgenticDrawer: () => {},
      consumePendingPrompt: () => null,
    };
  }
  return context;
}
