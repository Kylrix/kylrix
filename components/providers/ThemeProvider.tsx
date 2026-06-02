'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useEcosystemNode } from '@/hooks/useEcosystemNode';

type ColorModeContextType = {
  toggleColorMode: () => void;
  mode: 'light' | 'dark';
};

const ColorModeContext = createContext<ColorModeContextType>({ toggleColorMode: () => {}, mode: 'light' });

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEcosystemNode('connect');

  useEffect(() => {
    const saved = localStorage.getItem('kylrixconnect-theme') as 'light' | 'dark' | null;
    if (saved) {
      setMode(saved);
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setMode('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kylrixconnect-theme', mode);
    document.documentElement.dataset.theme = mode;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
  }, [mode]);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
      mode,
    }),
    [mode],
  );

  return <ColorModeContext.Provider value={colorMode}>{children}</ColorModeContext.Provider>;
};
