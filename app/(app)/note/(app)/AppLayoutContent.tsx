"use client";

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { Box } from '@mui/material';

export default function AppLayoutContent({ children }: { children: React.ReactNode }) {
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
      <Box component="main" sx={{ minWidth: 0 }}>
        <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
