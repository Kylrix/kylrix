'use client';

import React, { createContext, useContext, useState } from 'react';

interface DrawerStateContextType {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const DrawerStateContext = createContext<DrawerStateContextType | undefined>(undefined);

export const DrawerStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <DrawerStateContext.Provider value={{ isDrawerOpen, setIsDrawerOpen }}>
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
