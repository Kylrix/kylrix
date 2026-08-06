'use client';

import React from 'react';
import { Drawer, Box } from '@/lib/openbricks/primitives';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  UnifiedDrawerBody,
} from '@/components/overlays/UnifiedDrawerBody';

/**
 * Legacy shell — only login (and navbar no-op) still use floating drawers.
 * Everything else is bridged into the native right sidebar.
 */
export function UnifiedBottomDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(min-width: 768px)');
    const h = () => setIsDesktop(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);

  if (!activeContent || (activeContent as string) === 'navbar' || (activeContent as string) === 'note') return null;
  // Desktop new-chat is native right rail via ObjectCreateDrawer/DynamicSidebar — no bottom-drawer backdrop (prevents full-UI blur/dim)
  if (isDesktop && (activeContent as string) === 'new-chat') return null;

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
      open={Boolean(activeContent && (activeContent as string) !== 'navbar')}
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
