'use client';

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { DesktopSidebar } from './Navigation';
import { useSidebar } from './ui/SidebarContext';
import { DynamicSidebar, useDynamicSidebar } from './ui/DynamicSidebar';
import { ProUpgradeDrawer } from './overlays/ProUpgradeDrawer';
import { UnifiedBottomBar } from './UnifiedBottomBar';
import Topbar from './Topbar';

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const { isCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen } = useDynamicSidebar();

  // If it's a shared note page, we might want a different shell
  const isSharedPage = pathname?.includes('/shared/');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      {/* /(app) routes get UnifiedTopbar from app/(app)/layout.tsx; landing needs its own topbar */}
      {isLanding && <Topbar />}
      
      {!isLanding && !isSharedPage && <DesktopSidebar />}
      
      <Box
        component="main"
        sx={{
          minWidth: 0,
          pt: '88px', // Offset for fixed topbar
          pb: isLanding ? 0 : { xs: 12, md: 4 },
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          ml: (!isLanding && !isSharedPage) ? {
            md: isCollapsed ? '80px' : '280px'
          } : 0,
          mr: isDynamicSidebarOpen ? { md: '28rem', lg: '32rem' } : 0
        }}
      >
        {children}
      </Box>

      {!isLanding && !isSharedPage && <DynamicSidebar />}
      {!isLanding && <UnifiedBottomBar />}
      <ProUpgradeDrawer />
    </Box>
  );
}
