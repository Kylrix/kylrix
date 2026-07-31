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
import { useSidebar } from '@/components/ui/SidebarContext';

type RightRailOptions = {
  width?: number;
  key?: string;
};

type RightRailContextType = {
  isOpen: boolean;
  width: number;
  content: ReactNode | null;
  activeKey: string | null;
  open: (content: ReactNode, options?: RightRailOptions) => void;
  close: (key?: string) => void;
};

const RightRailContext = createContext<RightRailContextType | undefined>(undefined);

const DEFAULT_WIDTH = 420;

/**
 * Desktop native right rail — pushes main content (not a floating overlay).
 * Acquires left-nav contraction while open; releases on close without touching user preference.
 */
export function RightRailProvider({ children }: { children: ReactNode }) {
  const { acquireRightRail, releaseRightRail } = useSidebar();
  const [content, setContent] = useState<ReactNode | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const keyRef = useRef<string | null>(null);

  const close = useCallback(
    (key?: string) => {
      if (key && keyRef.current && key !== keyRef.current) return;
      if (keyRef.current) releaseRightRail(keyRef.current);
      keyRef.current = null;
      setContent(null);
      setWidth(DEFAULT_WIDTH);
    },
    [releaseRightRail],
  );

  const open = useCallback(
    (next: ReactNode, options?: RightRailOptions) => {
      const nextKey = options?.key ?? 'right-rail';
      if (keyRef.current && keyRef.current !== nextKey) {
        releaseRightRail(keyRef.current);
      }
      keyRef.current = nextKey;
      acquireRightRail(nextKey);
      setWidth(options?.width ?? DEFAULT_WIDTH);
      setContent(next);
    },
    [acquireRightRail, releaseRightRail],
  );

  useEffect(() => {
    return () => {
      if (keyRef.current) releaseRightRail(keyRef.current);
    };
  }, [releaseRightRail]);

  const value = useMemo(
    () => ({
      isOpen: content !== null,
      width,
      content,
      activeKey: keyRef.current,
      open,
      close,
    }),
    [content, width, open, close],
  );

  return <RightRailContext.Provider value={value}>{children}</RightRailContext.Provider>;
}

export function useRightRail() {
  const ctx = useContext(RightRailContext);
  if (!ctx) {
    throw new Error('useRightRail must be used within a RightRailProvider');
  }
  return ctx;
}

export function useRightRailOptional() {
  return useContext(RightRailContext);
}
