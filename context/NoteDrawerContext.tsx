'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const NoteDrawerContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
} | undefined>(undefined);

export function NoteDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <NoteDrawerContext.Provider value={{ isOpen, open, close }}>
      {children}
    </NoteDrawerContext.Provider>
  );
}

export function useNoteDrawer() {
  const context = useContext(NoteDrawerContext);
  if (!context) throw new Error('useNoteDrawer must be used within NoteDrawerProvider');
  return context;
}
