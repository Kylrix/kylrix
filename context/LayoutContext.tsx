'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

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

  const openSecondarySidebar = (type: ItemType, itemId: string, data?: any) => {
    setSecondarySidebar({
      isOpen: true,
      type,
      itemId,
      data,
    });
  };

  const closeSecondarySidebar = () => {
    setSecondarySidebar((prev) => ({
      ...prev,
      isOpen: false,
      // We keep type/id briefly for animation purposes if needed, or clear them. 
      // Clearing them usually prevents "flashing" wrong content on next open if generic.
      // But keeping them allows fading out the old content. 
      // Let's keep them for now, but isOpen controls visibility.
    }));
  };

  const toggleSecondarySidebar = () => {
    setSecondarySidebar((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  };

  return (
    <LayoutContext.Provider
      value={{
        secondarySidebar,
        openSecondarySidebar,
        closeSecondarySidebar,
        toggleSecondarySidebar,
      }}
    >
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

