"use client";

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useDynamicSidebar, DynamicSidebar } from '@/components/ui/DynamicSidebar';
import { DesktopSidebar, MobileBottomNav } from '@/components/Navigation';
import NoteTopbar from '@/components/common/NoteTopbar';
import { Box } from '@mui/material';

export default function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { isOpen: isDynamicSidebarOpen } = useDynamicSidebar();
  const pathname = usePathname();

  useEffect(() => {
    const mood = isDynamicSidebarOpen || pathname?.includes('/notes/') || pathname?.includes('/shared/')
      ? 'focus'
      : 'ambient';
    document.body.dataset.uiMood = mood;
    return () => {
      document.body.dataset.uiMood = 'ambient';
    };
  }, [isDynamicSidebarOpen, pathname]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      {/* Main layout container */}
      <NoteTopbar />
      <DesktopSidebar />
      
      {/* Main content area - offset to account for fixed sidebar and dynamic sidebar */}
      <Box
        component="main"
        sx={{
          minWidth: 0,
          pt: '88px',
          pb: { xs: 12, md: 4 },
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          ml: {
            md: isCollapsed ? '80px' : '280px'
          },
          mr: isDynamicSidebarOpen ? { md: '28rem', lg: '32rem' } : 0
        }}
      >
        {/* Content wrapper with proper padding */}
        <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 3 }}>
          {children}
        </Box>
      </Box>

      {/* Dynamic Sidebar - Also persistent */}
      <DynamicSidebar />
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </Box>
  );
}
