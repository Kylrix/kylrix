'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

type ItemType = 'task' | 'event' | 'focus' | null;

interface SecondarySidebarState {
  isOpen: boolean;
  type: ItemType;
  itemId: string | null;
  data?: any; // Optional data to pass directly to avoid fetching if we have it
}

interface LayoutContextType {
  secondarySidebar: SecondarySidebarState;
  openSecondarySidebar: (type: ItemType, itemId: string, data?: any) => void;
  closeSecondarySidebar: () => void;
  toggleSecondarySidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [secondarySidebar, setSecondarySidebar] = useState<SecondarySidebarState>({
    isOpen: false,
    type: null,
    itemId: null,
    data: null,
  });

  const openSecondarySidebar = useCallback((type: ItemType, itemId: string, data?: any) => {
    setSecondarySidebar({
      isOpen: true,
      type,
      itemId,
      data,
    });
  }, []);

  const closeSecondarySidebar = useCallback(() => {
    setSecondarySidebar((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const toggleSecondarySidebar = useCallback(() => {
    setSecondarySidebar((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  const value = useMemo<LayoutContextType>(
    () => ({
      secondarySidebar,
      openSecondarySidebar,
      closeSecondarySidebar,
      toggleSecondarySidebar,
    }),
    [secondarySidebar, openSecondarySidebar, closeSecondarySidebar, toggleSecondarySidebar]
  );

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

