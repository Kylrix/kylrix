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

  const isFullscreenMobile = ['pricing', 'tags', 'trash', 'profile-preview'].includes(activeContent as string);
  const isCompactBottomDrawer = [
    'share-context',
    'share-note',
    'delete-confirm',
    'delete-note',
    'security-confirm',
    'project-join-request-confirm',
    'access-control',
    'add-to-project',
    'task-add-to-project',
    'reaction-detail',
  ].includes(activeContent as string);

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
          borderTopLeftRadius: isFullscreenMobile ? 0 : '28px',
          borderTopRightRadius: isFullscreenMobile ? 0 : '28px',
          border: isFullscreenMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          borderBottom: 0,
          height: isFullscreenMobile ? '100dvh' : isCompactBottomDrawer ? 'auto' : '60dvh',
          maxHeight: isFullscreenMobile ? '100dvh' : '60dvh',
          maxWidth: isFullscreenMobile ? '100vw' : '640px',
          width: '100%',
          mx: 'auto',
          boxShadow: isFullscreenMobile ? 'none' : '0 -24px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ p: 0, position: 'relative', bgcolor: '#161412', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {content}
      </Box>
    </Drawer>
  );
}
