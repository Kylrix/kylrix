'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type TopbarPanel = 'search' | 'profile' | 'notifications' | null;

type TopbarPanelContextType = {
  panel: TopbarPanel;
  openPanel: (panel: Exclude<TopbarPanel, null>) => void;
  closePanel: () => void;
};

const TopbarPanelContext = createContext<TopbarPanelContextType | undefined>(undefined);

export function TopbarPanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<TopbarPanel>(null);
  const openPanel = useCallback((next: Exclude<TopbarPanel, null>) => setPanel(next), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const value = useMemo(
    () => ({ panel, openPanel, closePanel }),
    [panel, openPanel, closePanel],
  );
  return (
    <TopbarPanelContext.Provider value={value}>{children}</TopbarPanelContext.Provider>
  );
}

export function useTopbarPanel() {
  const ctx = useContext(TopbarPanelContext);
  if (!ctx) {
    return {
      panel: null as TopbarPanel,
      openPanel: (_: Exclude<TopbarPanel, null>) => {},
      closePanel: () => {},
    };
  }
  return ctx;
}
