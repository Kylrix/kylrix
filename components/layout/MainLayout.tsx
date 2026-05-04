'use client';

import React, { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import AppBar from '@/components/layout/AppBar';
import BottomNav from '@/components/layout/BottomNav';
import GlobalFAB from '@/components/layout/GlobalFAB';

const Sidebar = dynamic(() => import('@/components/layout/Sidebar'), { ssr: false });
const RightSidebar = dynamic(() => import('@/components/layout/RightSidebar'), { ssr: false });
const TaskDialog = dynamic(() => import('@/components/tasks/TaskDialog'), { ssr: false });

const DRAWER_WIDTH = 256;
const RIGHT_DRAWER_WIDTH = 420;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sidebarOpen } = useTask();
  const { secondarySidebar } = useLayout();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isEmbedded = useMemo(() => searchParams?.get('is_embedded') === 'true', [searchParams]);

  // Hide sidebar on event details pages
  const isEventPage = pathname?.startsWith('/events/') && pathname.split('/').length > 2;
  const showSidebar = !isMobile && !isEventPage && !isEmbedded;
  const showRightSidebar = secondarySidebar.isOpen && !isMobile && !isEmbedded;

  if (isEmbedded) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: '#000', 
        p: 2,
        overflow: 'auto',
        '&::-webkit-scrollbar': { display: 'none' }
      }}>
        {children}
        <TaskDialog />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--background)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AppBar />
      {/* Sidebar only visible on desktop and not on event pages */}
      {showSidebar && <Sidebar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 1, md: 2 },
          pt: { xs: `calc(64px + 12px)`, md: `calc(64px + 16px)` },
          pb: { xs: '80px', md: 2 },
          minHeight: '100vh',
          boxSizing: 'border-box',
          // Adjust width if sidebar is hidden
          maxWidth: '100vw',
          width: '100%',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(showSidebar && {
             width: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 0}px)`,
             ml: sidebarOpen ? 0 : 0, 
          }),
          ...(showRightSidebar && {
            width: `calc(100% - ${(showSidebar && sidebarOpen ? DRAWER_WIDTH : 0) + RIGHT_DRAWER_WIDTH}px)`,
            mr: `${RIGHT_DRAWER_WIDTH}px`,
          })
        }}
      >
        <Box
          sx={{
            background: 'rgba(15, 13, 12, 0.95)',
            backdropFilter: 'blur(25px) saturate(180%)',
            borderRadius: { xs: '24px', md: '32px' },
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minHeight: '100%',
            p: { xs: 2, md: 4 },
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
          }}
        >
        {children}
        </Box>
      </Box>
      
      <RightSidebar />
      
      <GlobalFAB />
      
      {/* BottomNav only visible on mobile */}
      {isMobile && !isEventPage && <BottomNav />}
      
      {/* Global Dialogs */}
      <TaskDialog />
    </Box>
  );
}
