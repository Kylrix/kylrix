'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export type AppChromeMode = 'default' | 'compact' | 'hidden';

interface AppChromeState {
  mode: AppChromeMode;
  label: string | null;
  dockHeight: number;
}

interface AppChromeContextType extends AppChromeState {
  headerHeight: number;
  setChromeState: (next: Partial<AppChromeState>) => void;
  resetChromeState: () => void;
}

const DEFAULT_STATE: AppChromeState = {
  mode: 'default',
  label: null,
  dockHeight: 0,
};

const AppChromeContext = createContext<AppChromeContextType | undefined>(undefined);

export function AppChromeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppChromeState>(DEFAULT_STATE);
  const pathname = usePathname();
  const setChromeState = React.useCallback((next: Partial<AppChromeState>) => {
    setState((current) => {
      const merged = { ...current, ...next };
      if (
        merged.mode === current.mode &&
        merged.label === current.label &&
        merged.dockHeight === current.dockHeight
      ) {
        return current;
      }
      return merged;
    });
  }, []);

  const resetChromeState = React.useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  useEffect(() => {
    const mood = pathname?.startsWith('/chat/') || pathname?.startsWith('/post/')
      ? 'focus'
      : 'ambient';
    document.body.dataset.uiMood = mood;
    return () => {
      document.body.dataset.uiMood = 'ambient';
    };
  }, [pathname]);

  const value = useMemo<AppChromeContextType>(() => {
    const baseHeight = state.mode === 'compact' ? 72 : state.mode === 'hidden' ? 0 : 88;
    const headerHeight = baseHeight + state.dockHeight;

    return {
      ...state,
      headerHeight,
      setChromeState,
      resetChromeState,
    };
  }, [resetChromeState, setChromeState, state]);

  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}

export function useAppChrome() {
  const context = useContext(AppChromeContext);
  if (!context) {
    throw new Error('useAppChrome must be used within an AppChromeProvider');
  }
  return context;
}
