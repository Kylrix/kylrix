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
    <Box sx={{ px: { xs: 1, md: 2, lg: 3 }, py: 0 }}>
      {children}
    </Box>
  );
}
