'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

const LoginDrawerContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
} | undefined>(undefined);

export function LoginDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <LoginDrawerContext.Provider value={{ isOpen, open, close }}>
      {children}
    </LoginDrawerContext.Provider>
  );
}

export function useLoginDrawer() {
  const context = useContext(LoginDrawerContext);
  if (!context) throw new Error('useLoginDrawer must be used within LoginDrawerProvider');
  return context;
}
