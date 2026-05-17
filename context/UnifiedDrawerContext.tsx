'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type DrawerContent = 'navbar' | 'login' | 'agentic' | 'note' | 'wallet' | 'masterpass' | 'share-note' | 'delete-note';

interface UnifiedDrawerContextType {
  activeContent: DrawerContent;
  drawerData: any;
  open: (content: DrawerContent, data?: any) => void;
  close: () => void;
}

const UnifiedDrawerContext = createContext<UnifiedDrawerContextType | undefined>(undefined);

export function UnifiedDrawerProvider({ children }: { children: ReactNode }) {
  const [activeContent, setActiveContent] = useState<DrawerContent>('navbar');
  const [drawerData, setDrawerData] = useState<any>(null);
  
  const open = useCallback((content: DrawerContent, data?: any) => {
    setDrawerData(data || null);
    setActiveContent(content);
  }, []);

  const close = useCallback(() => {
    setActiveContent('navbar');
    setDrawerData(null);
  }, []);

  return (
    <UnifiedDrawerContext.Provider value={{ activeContent, drawerData, open, close }}>
      {children}
    </UnifiedDrawerContext.Provider>
  );
}

export function useUnifiedDrawer() {
  const context = useContext(UnifiedDrawerContext);
  if (!context) throw new Error('useUnifiedDrawer must be used within UnifiedDrawerProvider');
  return context;
}
