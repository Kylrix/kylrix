'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type DrawerContent = 'navbar' | 'login' | 'agentic' | 'note' | 'wallet' | 'masterpass';

interface UnifiedDrawerContextType {
  activeContent: DrawerContent;
  open: (content: DrawerContent) => void;
  close: () => void;
}

const UnifiedDrawerContext = createContext<UnifiedDrawerContextType | undefined>(undefined);

export function UnifiedDrawerProvider({ children }: { children: ReactNode }) {
  const [activeContent, setActiveContent] = useState<DrawerContent>('navbar');
  
  const open = useCallback((content: DrawerContent) => {
    setActiveContent(content);
  }, []);

  const close = useCallback(() => {
    setActiveContent('navbar');
  }, []);

  return (
    <UnifiedDrawerContext.Provider value={{ activeContent, open, close }}>
      {children}
    </UnifiedDrawerContext.Provider>
  );
}

export function useUnifiedDrawer() {
  const context = useContext(UnifiedDrawerContext);
  if (!context) throw new Error('useUnifiedDrawer must be used within UnifiedDrawerProvider');
  return context;
}
