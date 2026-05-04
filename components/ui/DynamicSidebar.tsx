'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  Drawer, 
  Box, 
  Typography, 
  IconButton
} from '@mui/material';
import { Close as CloseIcon, ArrowBack as BackIcon } from '@mui/icons-material';

interface DynamicSidebarContextType {
  isOpen: boolean;
  content: ReactNode | null;
  activeContentKey: string | null;
  openSidebar: (content: ReactNode, key?: string | null) => void;
  closeSidebar: () => void;
}

const DynamicSidebarContext = createContext<DynamicSidebarContextType | undefined>(undefined);

export function DynamicSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [activeContentKey, setActiveContentKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kylrixnote_dynamic_sidebar_key');
  });

  const openSidebar = React.useCallback(
    (newContent: ReactNode, key: string | null = null) => {
      if (isOpen && key && activeContentKey === key) {
        return;
      }
      setContent(newContent);
      setActiveContentKey(key);
      setIsOpen(true);
      if (key) {
        localStorage.setItem('kylrixnote_dynamic_sidebar_key', key);
      }
    },
    [activeContentKey, isOpen]
  );

  const closeSidebar = React.useCallback(() => {
    setIsOpen(false);
    setActiveContentKey(null);
    localStorage.removeItem('kylrixnote_dynamic_sidebar_key');
    // Delay clearing content to allow for exit animation
    setTimeout(() => {
      setContent(null);
    }, 300);
  }, []);

  const providerValue = React.useMemo(
    () => ({ isOpen, content, activeContentKey, openSidebar, closeSidebar }),
    [isOpen, content, activeContentKey, openSidebar, closeSidebar]
  );

  return (
    <DynamicSidebarContext.Provider value={providerValue}>
      {children}
    </DynamicSidebarContext.Provider>
  );
}

export function useDynamicSidebar() {
  const context = useContext(DynamicSidebarContext);
  if (context === undefined) {
    throw new Error('useDynamicSidebar must be used within a DynamicSidebarProvider');
  }
  return context;
}

export function DynamicSidebar() {
  const { isOpen, content, closeSidebar } = useDynamicSidebar();

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={closeSidebar}
      variant="temporary"
      PaperProps={{
        'data-dynamic-sidebar': 'true', // Add this to prevent layout listener from closing it
        sx: {
          width: {
            xs: '100%',
            sm: 400,
            md: 450,
            lg: 500
          },
          bgcolor: 'var(--color-surface)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile.
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        p: { xs: 2, sm: 3 },
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            onClick={closeSidebar} 
            size="small"
            sx={{ 
              display: { xs: 'inline-flex', sm: 'none' },
              color: 'rgba(255, 255, 255, 0.5)',
              '&:hover': { color: '#6366F1', bgcolor: 'var(--color-surface-2)' }
            }}
          >
            <BackIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 900, 
              fontFamily: '"Space Grotesk", sans-serif',
              color: '#6366F1',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }}
          >
            Details
          </Typography>
        </Box>
        <IconButton 
          onClick={closeSidebar} 
          size="small"
          sx={{ 
            display: { xs: 'none', sm: 'inline-flex' },
            color: 'rgba(255, 255, 255, 0.5)',
            '&:hover': { color: '#6366F1', bgcolor: 'var(--color-surface-2)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {content}
      </Box>
    </Drawer>
  );
}
