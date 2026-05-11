"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

type OverlayContent = ReactNode;

interface OverlayContextType {
  isOpen: boolean;
  content: OverlayContent;
  openOverlay: (content: OverlayContent) => void;
  closeOverlay: () => void;
}

const OverlayContext = createContext<OverlayContextType | undefined>(undefined);

export const OverlayProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<OverlayContent>(null);

  const openOverlay = useCallback((newContent: OverlayContent) => {
    setContent(newContent);
    setIsOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOpen(false);
    setContent(null);
  }, []);

  const value = useMemo<OverlayContextType>(
    () => ({ isOpen, content, openOverlay, closeOverlay }),
    [isOpen, content, openOverlay, closeOverlay]
  );

  return (
    <OverlayContext.Provider value={value}>
      {children}
    </OverlayContext.Provider>
  );
};

export const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (context === undefined) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
};
