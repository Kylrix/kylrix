'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'kylrixnote_sidebar_collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, isCollapsed ? 'true' : 'false');
    }
  }, [isCollapsed, isLoaded]);

  const setCollapsed = useCallback((collapsed: boolean | ((prev: boolean) => boolean)) => {
    setIsCollapsed(collapsed);
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed: setCollapsed }}>
      <Box sx={{ 
        visibility: isLoaded ? 'visible' : 'hidden', 
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
        minHeight: '100vh'
      }}>
        {children}
      </Box>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
