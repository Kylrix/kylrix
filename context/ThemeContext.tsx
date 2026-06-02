'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PaletteMode } from '../theme/theme';

type ColorModeContextType = {
  toggleColorMode: () => void;
  mode: PaletteMode;
};

const ColorModeContext = createContext<ColorModeContextType>({
  toggleColorMode: () => {},
  mode: 'dark',
});

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<PaletteMode>('dark');

  useEffect(() => {
    const savedMode = localStorage.getItem('kylrix-theme-mode') as PaletteMode;
    if (savedMode) {
      setMode(savedMode);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setMode('light');
    }
  }, []);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('kylrix-theme-mode', newMode);
          return newMode;
        });
      },
      mode,
    }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      {children}
    </ColorModeContext.Provider>
  );
};
