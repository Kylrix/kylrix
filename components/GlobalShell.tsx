'use client';

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { DesktopSidebar } from './Navigation';
import { useSidebar } from './ui/SidebarContext';
import { DynamicSidebar, useDynamicSidebar } from './ui/DynamicSidebar';
import { ProUpgradeDrawer } from './overlays/ProUpgradeDrawer';
import { UnifiedBottomBar } from './UnifiedBottomBar';
import NoteTopbar from '@/components/common/NoteTopbar';

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const isAppRoute = Boolean(
    pathname?.startsWith('/note') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  );
  const isWebsiteRoute = !isAppRoute;
  const { isCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen } = useDynamicSidebar();
  
  // If it's a shared note page, we might want a different shell
  const isSharedPage = pathname?.includes('/shared/');
  
  const shouldShowBottomBar = Boolean(
    isAppRoute &&
      !isSharedPage &&
      pathname !== '/settings' &&
      (!pathname?.startsWith('/vault') || pathname?.startsWith('/vault/dashboard'))
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      {/* /(app) routes get UnifiedTopbar from app/(app)/layout.tsx; website pages share the landing topbar */}
      {isWebsiteRoute && <NoteTopbar />}
      
      {isAppRoute && !isSharedPage && <DesktopSidebar />}
      
      <Box
        component="main"
        sx={{
          minWidth: 0,
          pt: '88px', // Offset for fixed topbar
          pb: isWebsiteRoute ? 0 : { xs: 12, md: 4 },
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          ml: (isAppRoute && !isSharedPage) ? {
            md: isCollapsed ? '80px' : '280px'
          } : 0,
          mr: isDynamicSidebarOpen ? { md: '28rem', lg: '32rem' } : 0
        }}
      >
        {children}
      </Box>

      {isAppRoute && !isSharedPage && <DynamicSidebar />}
      {shouldShowBottomBar && <UnifiedBottomBar />}
      <ProUpgradeDrawer />
    </Box>
  );
}
