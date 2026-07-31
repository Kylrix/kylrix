'use client';

import React from 'react';
import { Drawer, Box } from '@/lib/openbricks/primitives';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  isUnifiedOverlayOnly,
  UnifiedDrawerBody,
} from '@/components/overlays/UnifiedDrawerBody';

/**
 * Legacy shell — only login (and navbar no-op) still use floating drawers.
 * Everything else is bridged into the native right sidebar.
 */
export function UnifiedBottomDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();

  if (activeContent === 'navbar') return null;
  if (!isUnifiedOverlayOnly(activeContent)) return null;

  const content = (
    <UnifiedDrawerBody
      activeContent={activeContent}
      drawerData={drawerData}
      onClose={close}
    />
  );

  return (
    <Drawer
      anchor="bottom"
      open={activeContent === 'login'}
      onClose={close}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '92dvh',
        },
      }}
    >
      <Box sx={{ p: 0 }}>{content}</Box>
    </Drawer>
  );
}
