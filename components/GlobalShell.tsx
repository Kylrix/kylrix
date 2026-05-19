'use client';

import React, { ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box, alpha } from '@mui/material';

// Core UI Components (Direct Imports for Stability)
import ConnectTopbar from '@/components/layout/ConnectTopbar';
import { UnifiedBottomBar } from '@/components/UnifiedBottomBar';

// Context Hooks
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebarContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useSidebar as useSidebarContext } from '@/components/ui/SidebarContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import QuickCreateFab from '@/components/ui/QuickCreateFab';
import GlobalFAB from '@/components/layout/GlobalFAB';

// Lazy Components
const UnifiedBottomDrawer = dynamic(() => import('./overlays/UnifiedBottomDrawer').then(m => m.UnifiedBottomDrawer), { ssr: false });
const ProUpgradeDrawer = dynamic(() => import('./overlays/ProUpgradeDrawer').then(m => m.ProUpgradeDrawer), { ssr: false });
const TaskDialog = dynamic(() => import('@/components/tasks/TaskDialog'), { ssr: false });
const Overlay = dynamic(() => import('@/components/ui/Overlay'), { ssr: false });
const DynamicSidebar = dynamic(() => import('./ui/DynamicSidebarPanel').then(m => m.DynamicSidebar), { ssr: false });
const RightSidebar = dynamic(() => import('./layout/RightSidebar'), { ssr: false });
const AgenticDrawer = dynamic(() => import('./overlays/AgenticDrawer').then(m => m.AgenticDrawer), { ssr: false });

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  
  // 1. Route Analysis
  const isAppRoute = useMemo(() => Boolean(
    pathname?.startsWith('/note') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/projects') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  ), [pathname]);

  const isSharedPage = pathname?.includes('/shared/');
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  const isProjectsPage = pathname?.startsWith('/projects');
  const isLandingPage = pathname === '/';
  const isConnectPage = pathname?.startsWith('/connect');

  // 2. UI State
  const { activeContent: unifiedDrawerActive, open: openUnified } = useUnifiedDrawer();
  const { showProUpgrade, closeProUpgrade } = useProUpgrade();
  const { taskDialogOpen } = useTask();
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const { isOpen: isOverlayOpen, closeOverlay } = useOverlay();
  const { isOpen: isDynamicSidebarOpen, closeSidebar } = useDynamicSidebar();
  const { isCollapsed } = useSidebarContext();
  const { closeWallet } = useWalletOverlay();
  const { isOpen: isAgenticDrawerOpen, closeAgenticDrawer } = useAgenticDrawer();

  // 3. Automated Logic
  useEffect(() => {
    if (!isLoading && !user && isAppRoute && !isSharedPage) {
      openUnified('login');
    }
  }, [isLoading, user, isAppRoute, isSharedPage, openUnified]);

  useEffect(() => {
    // Single-batch UI reset on navigation
    closeSidebar();
    closeOverlay();
    closeWallet();
    closeProUpgrade();
    closeSecondarySidebar();
    closeAgenticDrawer();
  }, [pathname, closeSidebar, closeOverlay, closeWallet, closeProUpgrade, closeSecondarySidebar, closeAgenticDrawer]);

  // 4. Stacking Determinism
  const TOPBAR_Z = 1200;

  return (
    <Box 
        sx={{ 
            minHeight: '100vh', 
            bgcolor: '#0A0908', 
            color: '#fff',
            position: 'relative',
            overflowX: 'hidden'
        }}
    >
      {/* --- LAYER 0: CONTENT --- */}
      <Box
        component="main"
        sx={{
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          pt: '88px', // Exact Topbar height
          pb: isLandingPage ? 0 : { xs: 12, md: 4 },
          px: { xs: 0, sm: 2, md: 4 },
          maxWidth: 1600,
          mx: 'auto',
          minHeight: '100vh',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </Box>

      {/* --- LAYER 1: CHROME --- */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: TOPBAR_Z, pointerEvents: 'none' }}>
        <Box sx={{ pointerEvents: 'auto' }}>
            <ConnectTopbar />
        </Box>
      </Box>

      {isAppRoute && !isSharedPage && !isVaultResetRoute && !isLandingPage && !isProjectsPage && (
        <UnifiedBottomBar />
      )}
      {isAppRoute && !isSharedPage && !isVaultResetRoute && !isLandingPage && !isProjectsPage && !isConnectPage && (
        <QuickCreateFab />
      )}
      <GlobalFAB />

      {/* --- LAYER 2: OVERLAYS (Strict Unmounting) --- */}
      {isOverlayOpen && <Overlay />}
      {unifiedDrawerActive !== 'navbar' && !isProjectsPage && <UnifiedBottomDrawer />}
      {showProUpgrade && <ProUpgradeDrawer />}
      {taskDialogOpen && <TaskDialog />}
      {isDynamicSidebarOpen && <DynamicSidebar />}
      {secondarySidebar.isOpen && <RightSidebar />}
      {isAgenticDrawerOpen && <AgenticDrawer />}
    </Box>
  );
}
