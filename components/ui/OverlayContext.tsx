"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

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

  const openOverlay = (newContent: OverlayContent) => {
    setContent(newContent);
    setIsOpen(true);
  };

  const closeOverlay = () => {
    setIsOpen(false);
    setContent(null);
  };

  return (
    <OverlayContext.Provider value={{ isOpen, content, openOverlay, closeOverlay }}>
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
