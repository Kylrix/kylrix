'use client';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useRef
} from 'react';

export interface DynamicSidebarContextType {
  isOpen: boolean;
  content: ReactNode | null;
  activeContentKey: string | null;
  openSidebar: (content: ReactNode, key?: string | null) => void;
  closeSidebar: () => void;
}

const DynamicSidebarContext = createContext<DynamicSidebarContextType | undefined>(undefined);

export function DynamicSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [activeContentKey, setActiveContentKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kylrixnote_dynamic_sidebar_key');
  });

  // Use refs to keep callbacks stable and prevent massive list re-renders
  const stateRef = useRef({ isOpen, activeContentKey });
  stateRef.current = { isOpen, activeContentKey };

  const openSidebar = useCallback(
    (newContent: ReactNode, key: string | null = null) => {
      const state = stateRef.current;
      if (state.isOpen && key && state.activeContentKey === key) {
        return;
      }
      setContent(newContent);
      setActiveContentKey(key);
      setIsOpen(true);
      if (key) {
        localStorage.setItem('kylrixnote_dynamic_sidebar_key', key);
      }
    },
    [] // Stable identity
  );

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    setActiveContentKey(null);
    localStorage.removeItem('kylrixnote_dynamic_sidebar_key');
    // Delay clearing content for exit animation
    setTimeout(() => {
      setContent(null);
    }, 300);
  }, []);

  const providerValue = useMemo(
    () => ({ isOpen, content, activeContentKey, openSidebar, closeSidebar }),
    [isOpen, content, activeContentKey, openSidebar, closeSidebar]
  );

  return (
    <DynamicSidebarContext.Provider value={providerValue}>
      {children}
    </DynamicSidebarContext.Provider>
  );
}

export function useDynamicSidebar() {
  const context = useContext(DynamicSidebarContext);
  if (context === undefined) {
    throw new Error('useDynamicSidebar must be used within a DynamicSidebarProvider');
  }
  return context;
}
