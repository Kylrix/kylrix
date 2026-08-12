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
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia('(min-width: 768px)');
    const h = () => setIsDesktop(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);

  if (!activeContent || (activeContent as string) === 'navbar' || (activeContent as string) === 'note') return null;
  // Desktop: native right rail only — never render bottom drawer for sidebar surfaces (nuclear wipe = right sidebar, not drawer)
  if ((['new-chat', 'delete-confirm', 'delete-note', 'security-confirm', 'project-join-request-confirm'] as string[]).includes(activeContent as string)) {
    if (isDesktop) return null;
    // mobile stays as bottom drawer — fall through
  }

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
          maxHeight: '60dvh',
        },
      }}
    >
      <Box sx={{ p: 0 }}>{content}</Box>
    </Drawer>
  );
}
