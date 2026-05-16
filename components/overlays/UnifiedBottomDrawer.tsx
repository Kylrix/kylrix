'use client';

import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { X } from 'lucide-react';
import Drawer from '@mui/material/Drawer';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDrawerState } from '@/components/ui/DrawerStateContext';

// Import all dynamic drawer components
import { LoginDrawer } from './LoginDrawer';
import { AgenticDrawer } from './AgenticDrawer';
import { NoteDrawer } from './NoteDrawer';
// ... etc

const DRAWER_SX = {
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  bgcolor: '#161412',
  borderTop: '1px solid #34322F',
  maxWidth: 720,
  width: '100%',
  mx: 'auto'
};

export function UnifiedBottomDrawer() {
  const { activeContent, close } = useUnifiedDrawer();

  // The child components (LoginDrawer, AgenticDrawer, NoteDrawer) already contain their own <Drawer> 
  // wrappers with specific dimensions/styles. We just render the active one here.
  switch (activeContent) {
    case 'login': return <LoginDrawer />;
    case 'agentic': return <AgenticDrawer />;
    case 'note': return <NoteDrawer />;
    default: return null;
  }
}
