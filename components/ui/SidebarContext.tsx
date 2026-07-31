'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Box } from '@/lib/openbricks/primitives';

interface SidebarContextType {
  /** Effective collapsed (user preference OR forced by right rail). */
  isCollapsed: boolean;
  /** User's own preference from the ecosystem icon — persisted. */
  userCollapsed: boolean;
  /** True while a native right rail is pushing the layout. */
  isRightRailPushing: boolean;
  /** Toggle / set the user preference (ecosystem icon). */
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  /** Right-rail surfaces call these — does not change user preference. */
  acquireRightRail: (key?: string) => void;
  releaseRightRail: (key?: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'kylrixnote_sidebar_collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(true);
  const railKeysRef = useRef<Set<string>>(new Set());
  const [railDepth, setRailDepth] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setUserCollapsed(saved === 'true');
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, userCollapsed ? 'true' : 'false');
  }, [userCollapsed, isLoaded]);

  const setIsCollapsed = useCallback((collapsed: boolean | ((prev: boolean) => boolean)) => {
    setUserCollapsed((prev) =>
      typeof collapsed === 'function' ? collapsed(prev) : collapsed,
    );
  }, []);

  const acquireRightRail = useCallback((key = 'default') => {
    const set = railKeysRef.current;
    if (set.has(key)) return;
    set.add(key);
    setRailDepth(set.size);
  }, []);

  const releaseRightRail = useCallback((key = 'default') => {
    const set = railKeysRef.current;
    if (!set.has(key)) return;
    set.delete(key);
    setRailDepth(set.size);
  }, []);

  const isRightRailPushing = railDepth > 0;
  const isCollapsed = userCollapsed || isRightRailPushing;

  const contextValue = useMemo<SidebarContextType>(
    () => ({
      isCollapsed,
      userCollapsed,
      isRightRailPushing,
      setIsCollapsed,
      acquireRightRail,
      releaseRightRail,
    }),
    [
      isCollapsed,
      userCollapsed,
      isRightRailPushing,
      setIsCollapsed,
      acquireRightRail,
      releaseRightRail,
    ],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <Box
        sx={{
          visibility: isLoaded ? 'visible' : 'hidden',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
