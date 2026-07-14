'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type DrawerContent = 'navbar' | 'login' | 'agentic' | 'note' | 'wallet' | 'masterpass' | 'share-note' | 'delete-note' | 'assign-goal' | 'task-add-to-project' | 'new-chat' | 'new-channel' | 'new-tag' | 'tag-selector' | 'new-project' | 'secure-chat-setup' | 'passkey-setup' | 'delete-confirm' | 'security-confirm' | 'pro-upgrade' | 'project-invite' | 'form' | 'github-integration' | 'form-response-detail' | 'project-settings' | 'project-visibility' | 'project-auto-sweep' | 'project-join-request-confirm' | 'moment-composer';

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
