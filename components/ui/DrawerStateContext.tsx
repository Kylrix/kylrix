'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface DrawerStateContextType {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const DrawerStateContext = createContext<DrawerStateContextType | undefined>(undefined);

export const DrawerStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDrawerOpen, setDrawerOpenState] = useState(false);
  const setIsDrawerOpen = useCallback((open: boolean) => setDrawerOpenState(open), []);
  const value = useMemo<DrawerStateContextType>(
    () => ({ isDrawerOpen, setIsDrawerOpen }),
    [isDrawerOpen, setIsDrawerOpen]
  );

  return (
    <DrawerStateContext.Provider value={value}>
      {children}
    </DrawerStateContext.Provider>
  );
};

export const useDrawerState = () => {
  const context = useContext(DrawerStateContext);
  if (!context) {
    throw new Error('useDrawerState must be used within DrawerStateProvider');
  }
  return context;
};
