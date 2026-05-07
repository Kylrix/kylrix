'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface AgenticDrawerContextValue {
  isOpen: boolean;
  openAgenticDrawer: () => void;
  closeAgenticDrawer: () => void;
}

const AgenticDrawerContext = createContext<AgenticDrawerContextValue | undefined>(undefined);

export function AgenticDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<AgenticDrawerContextValue>(
    () => ({
      isOpen,
      openAgenticDrawer: () => setIsOpen(true),
      closeAgenticDrawer: () => setIsOpen(false),
    }),
    [isOpen],
  );

  return <AgenticDrawerContext.Provider value={value}>{children}</AgenticDrawerContext.Provider>;
}

export function useAgenticDrawer() {
  const context = useContext(AgenticDrawerContext);
  if (!context) {
    return {
      isOpen: false,
      openAgenticDrawer: () => {},
      closeAgenticDrawer: () => {},
    };
  }
  return context;
}
