'use client';

import React, { ReactNode, Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box, alpha } from '@/lib/openbricks/primitives';

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
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useSidebar as useSidebarContext } from '@/components/ui/SidebarContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { FABProvider } from '@/context/FABContext';
import UniversalFAB from '@/components/layout/UniversalFAB';

import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';

// Lazy Components
const UnifiedBottomDrawer = dynamic(() => import('./overlays/UnifiedBottomDrawer').then(m => m.UnifiedBottomDrawer), { ssr: false });
const ProUpgradeDrawer = dynamic(() => import('./overlays/ProUpgradeDrawer').then(m => m.ProUpgradeDrawer), { ssr: false });
const TaskDialog = dynamic(() => import('@/components/tasks/TaskDialog'), { ssr: false });
const PasskeyReminderDrawer = dynamic(() => import('./overlays/PasskeyReminderDrawer').then(m => ({ default: m.PasskeyReminderDrawer })), { ssr: false });
const Overlay = dynamic(() => import('@/components/ui/Overlay'), { ssr: false });
const DynamicSidebar = dynamic(() => import('./ui/DynamicSidebarPanel').then(m => m.DynamicSidebar), { ssr: false });
const RightSidebar = dynamic(() => import('./layout/RightSidebar'), { ssr: false });
const AgenticDrawer = dynamic(() => import('./overlays/AgenticDrawer').then((m) => m.AgenticDrawer), { ssr: false });
const UnifiedLeftSidebar = dynamic(() => import('./UnifiedLeftSidebar').then(m => m.UnifiedLeftSidebar), { ssr: false });
const AccountHealthDrawers = dynamic(() => import('./onboarding/AccountHealthDrawers').then(m => m.AccountHealthDrawers), { ssr: false });

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  
  // 0. Aggressive Optimization Hooks
  useServiceWorker();

  // 1. Route Analysis
  const isAppRoute = useMemo(() => Boolean(
    pathname?.startsWith('/app') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/projects') ||
    pathname?.startsWith('/tags') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  ), [pathname]);

  const isSharedPage = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.includes('/shared/') ||
      pathname.startsWith('/flow/goal/') ||
      pathname.startsWith('/flow/form/') ||
      pathname.startsWith('/flow/forms/') ||
      pathname.startsWith('/flow/events/') ||
      pathname.startsWith('/connect/call/') ||
      pathname.startsWith('/send') ||
      pathname.startsWith('/i/') ||
      pathname.startsWith('/u/')
    );
  }, [pathname]);
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  const isLandingPage = pathname === '/';
  const isConnectPage = pathname?.startsWith('/connect');

  // 2. UI State
  const { activeContent: unifiedDrawerActive, open: openUnified, close: closeUnified } = useUnifiedDrawer();
  const { showProUpgrade, closeProUpgrade } = useProUpgrade();
  const { taskDialogOpen } = useTask();
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const { isOpen: isOverlayOpen, closeOverlay } = useOverlay();
  const { isOpen: isDynamicSidebarOpen, closeSidebar } = useDynamicSidebar();
  const { isCollapsed } = useSidebarContext();
  const { isWalletOpen, closeWallet } = useWalletOverlay();
  const { isOpen: isAgenticDrawerOpen, closeAgenticDrawer } = useAgenticDrawer();
  const { mode } = useAppChrome();
  const { isDrawerOpen, setIsDrawerOpen } = useDrawerState();
  const { isOpen: isCallLauncherOpen } = useCallLauncher();

  // Smart responsive Left Sidebar visibility
  const isNoteFullPageDetail = useMemo(
    () => Boolean(pathname?.match(/^\/idea\/[^/]+$/)),
    [pathname],
  );
  const isConnectCallDetail = useMemo(() => Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/)), [pathname]);
  const isConnectChatPage = useMemo(() => Boolean(pathname?.startsWith('/connect/chats') || pathname?.match(/^\/connect\/chat\/[^/]+$/)), [pathname]);
  const isSpecificPostPage = useMemo(() => Boolean(pathname?.startsWith('/connect/post/')), [pathname]);
  const isProjectDetailPage = useMemo(() => Boolean(pathname?.match(/^\/projects\/[^/]+$/)), [pathname]);

  const showLeftSidebar = useMemo(() => Boolean(
    isAppRoute &&
    !isSharedPage &&
    !isVaultResetRoute &&
    !isLandingPage &&
    !isConnectChatPage
  ), [
    isAppRoute,
    isSharedPage,
    isVaultResetRoute,
    isLandingPage,
    isConnectChatPage
  ]);

  const mainClassName = useMemo(() => {
    const parts = ['kylrix-main-content'];
    if (showLeftSidebar) parts.push('with-sidebar');
    if (isProjectDetailPage) parts.push('project-detail');
    if (isNoteFullPageDetail) parts.push('note-detail');
    return parts.join(' ');
  }, [showLeftSidebar, isProjectDetailPage, isNoteFullPageDetail]);

  // 3. Automated Logic
  useEffect(() => {
    if (!isLoading && !user && isAppRoute && !isSharedPage) {
      openUnified('login');
    }
  }, [isLoading, user, isAppRoute, isSharedPage, openUnified]);

  // Wire up programmatically opening the agentic drawer via custom event listeners
  const { openAgenticDrawer } = useAgenticDrawer();
  useEffect(() => {
    const handleOpenAgentic = (e: CustomEvent<{ prompt?: string; autoRun?: boolean }>) => {
      openAgenticDrawer(e.detail);
    };
    window.addEventListener('kylrix:open-agentic-drawer' as any, handleOpenAgentic);
    return () => window.removeEventListener('kylrix:open-agentic-drawer' as any, handleOpenAgentic);
  }, [openAgenticDrawer]);

  // Autonomic global sync engine initializer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/services/sync-engine').then(({ autonomicSyncEngine }) => {
        // Spin up first cycle to sync outstanding local drafts on boot
        void autonomicSyncEngine.runCycle();
      });
    }
  }, []);

  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    // Single-batch UI reset on navigation - ONLY call if currently open to prevent cascading update loops!
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      if (isDynamicSidebarOpen) closeSidebar();
      if (isOverlayOpen) closeOverlay();
      if (isWalletOpen) closeWallet();
      if (showProUpgrade) closeProUpgrade();
      if (secondarySidebar.isOpen) closeSecondarySidebar();
      if (isAgenticDrawerOpen) closeAgenticDrawer();
      if (isDrawerOpen) setIsDrawerOpen(false);
      if (unifiedDrawerActive !== 'navbar') closeUnified();
    }
  }, [
    pathname,
    isDynamicSidebarOpen,
    isOverlayOpen,
    isWalletOpen,
    showProUpgrade,
    secondarySidebar.isOpen,
    isAgenticDrawerOpen,
    isDrawerOpen,
    unifiedDrawerActive,
    closeSidebar,
    closeOverlay,
    closeWallet,
    closeProUpgrade,
    closeSecondarySidebar,
    closeAgenticDrawer,
    setIsDrawerOpen,
    closeUnified
  ]);

  // 4. Stacking Determinism
  const TOPBAR_Z = 1200;

  return (
    <Box 
        sx={{ 
            minHeight: '100vh', 
            bgcolor: '#000000', 
            color: '#fff',
            position: 'relative',
            overflowX: 'hidden'
        }}
    >
      <FABProvider>
      {/* --- LAYER 0: CONTENT --- */}
      <Box
        component="main"
        className={mainClassName}
        sx={{
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          pt: isSpecificPostPage ? 0 : isNoteFullPageDetail ? '72px' : '88px',
          pb: isSpecificPostPage ? 0 : (isLandingPage ? 0 : { xs: 12, md: 4 }),
          px: isProjectDetailPage ? { xs: 1, sm: 1, md: 2 } : isNoteFullPageDetail ? { xs: 0, sm: 0, md: 0 } : { xs: 2, sm: 2, md: 4 },
          pl: showLeftSidebar ? { xs: 2, md: isCollapsed ? '112px' : '272px' } : undefined,
          // Authoritative padding is now handled by CSS classes for 100% rigidity
          maxWidth: 1800,
          mx: 'auto',
          minHeight: '100vh',
          pointerEvents: 'auto',
          transition: 'padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </Box>

      {/* --- LAYER 1: CHROME --- */}
      {!isSpecificPostPage && (
        <Box 
          sx={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              zIndex: TOPBAR_Z, 
              pointerEvents: 'none',
              willChange: 'transform'
          }}
        >
          <Box sx={{ pointerEvents: 'auto' }}>
              <ConnectTopbar />
          </Box>
        </Box>
      )}

      {isAppRoute && !isSharedPage && !isVaultResetRoute && !isLandingPage && (
        <UnifiedBottomBar />
      )}
      
      {showLeftSidebar && (
        <Box sx={{ contain: 'layout size style', willChange: 'transform' }}>
            <UnifiedLeftSidebar />
        </Box>
      )}
      {isAppRoute && !isSharedPage && !isVaultResetRoute && !isLandingPage && !isConnectPage && (
        <Box sx={{ display: 'none' }} />
      )}
      {!isSharedPage && <UniversalFAB />}

      </FABProvider>

      {/* --- LAYER 2: OVERLAYS (Strict Unmounting) --- */}
      {isOverlayOpen && <Overlay />}
      {unifiedDrawerActive !== 'navbar' && <UnifiedBottomDrawer />}
      {showProUpgrade && <ProUpgradeDrawer />}
      {taskDialogOpen && <TaskDialog />}
      {isDynamicSidebarOpen && !isAppRoute && <DynamicSidebar />}
      {secondarySidebar.isOpen && <RightSidebar />}
      {isAgenticDrawerOpen && <AgenticDrawer />}
      <AccountHealthDrawers />
    </Box>
    );
    };

