'use client';

import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box } from '@/lib/openbricks/primitives';

// Core UI Components (Direct Imports for Stability)
import ConnectTopbar from '@/components/layout/ConnectTopbar';
import { UnifiedBottomBar } from '@/components/UnifiedBottomBar';

// Context Hooks
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useTask } from '@/context/TaskContext';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { isCommChatOverlayContent } from '@/components/objects/CommObjectDetail';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useSidebar as useSidebarContext } from '@/components/ui/SidebarContext';
import { useRightRailOptional } from '@/context/RightRailContext';
import { NativeSidebarBridge } from '@/components/layout/NativeSidebarBridge';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { FABProvider } from '@/context/FABContext';

import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useUnifiedFileDrawer } from '@/context/UnifiedFileDrawerContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { isSharedResourcePath } from '@/lib/routing/app-paths';
import { submitRuntimeErrorFeedback } from '@/lib/errors/runtime-feedback';

import { UnifiedLeftSidebar } from '@/components/UnifiedLeftSidebar';

// Lazy Components
const UnifiedBottomDrawer = dynamic(() => import('./overlays/UnifiedBottomDrawer').then(m => m.UnifiedBottomDrawer), { ssr: false });
const FlowsDrawer = dynamic(
  () => import('./flows/FlowsDrawer').then((m) => m.FlowsDrawer),
  { ssr: false },
);
const ChatCreateDrawer = dynamic(


  () => import('@/components/objects/ChatCreateDrawer').then((m) => m.ChatCreateDrawer),
  { ssr: false },
);
const ProUpgradeDrawer = dynamic(() => import('./overlays/ProUpgradeDrawer').then(m => m.ProUpgradeDrawer), { ssr: false });
const TaskDialog = dynamic(() => import('@/components/tasks/TaskDialog'), { ssr: false });
const NoteDrawer = dynamic(() => import('@/components/overlays/NoteDrawer').then(m => m.NoteDrawer), { ssr: false });
const RightSidebar = dynamic(() => import('./layout/RightSidebar'), { ssr: false });
const AccountHealthDrawers = dynamic(() => import('./onboarding/AccountHealthDrawers').then(m => m.AccountHealthDrawers), { ssr: false });
const UnifiedFileAttachmentDrawer = dynamic(() => import('./overlays/UnifiedFileAttachmentDrawer').then(m => m.UnifiedFileAttachmentDrawer), { ssr: false });
const Overlay = dynamic(() => import('@/components/ui/Overlay'), { ssr: false });
const AppDynamicSidebarPortal = dynamic(
  () => import('@/components/ui/AppDynamicSidebarPortal').then((m) => m.AppDynamicSidebarPortal),
  { ssr: false },
);

function useIsDesktopShell() {
  const [isDesktop, setIsDesktop] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return isDesktop;
}

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDesktopShell = useIsDesktopShell();
  
  // 0. Aggressive Optimization Hooks
  useServiceWorker();

  // 1. Route Analysis
  const isSharedPage = useMemo(() => isSharedResourcePath(pathname), [pathname]);

  const isAppRoute = useMemo(() => {
    if (!pathname || isSharedPage) return false;
    return Boolean(
      pathname === '/app' ||
      pathname.startsWith('/app/') ||
      pathname === '/flows' ||
      pathname.startsWith('/flows/') ||
      pathname === '/goals' ||
      pathname.startsWith('/goals/') ||
      pathname.startsWith('/forms') ||
      pathname.startsWith('/events') ||
      pathname.startsWith('/vault') ||
      pathname.startsWith('/workspaces') ||
      pathname.startsWith('/connect') ||
      pathname.startsWith('/accounts') ||
      pathname.startsWith('/settings')
    );
  }, [pathname, isSharedPage]);
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  const isLandingPage = pathname === '/';

  // 2. UI State
  const { activeContent: unifiedDrawerActive, close: closeUnified } = useUnifiedDrawer();
  const { showProUpgrade, closeProUpgrade } = useProUpgrade();
  const { taskDialogOpen } = useTask();
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const { isOpen: isOverlayOpen, content: overlayContent, closeOverlay } = useOverlay();
  const { isOpen: isDynamicSidebarOpen, closeSidebar } = useDynamicSidebar();
  const { isCollapsed } = useSidebarContext();
  const rightRail = useRightRailOptional();
  const { isWalletOpen, closeWallet } = useWalletOverlay();
  const { } = useAppChrome();
  const { isDrawerOpen, setIsDrawerOpen } = useDrawerState();
  const { isOpen: isUnifiedFileDrawerOpen } = useUnifiedFileDrawer();

  // Smart responsive Left Sidebar visibility
  const isNoteFullPageDetail = useMemo(
    () => Boolean(pathname?.startsWith('/idea/')),
    [pathname]);

  const isSpecificPostPage = useMemo(
    () =>
      Boolean(
        pathname?.startsWith('/connect/post/') || pathname?.startsWith('/moment/'),
      ),
    [pathname],
  );
  const isProjectDetailPage = useMemo(() => Boolean(pathname?.startsWith('/workspace/')), [pathname]);

  const showLeftSidebar = useMemo(() => Boolean(
    isAppRoute &&
    !isSharedPage &&
    !isVaultResetRoute &&
    !isLandingPage
  ), [
    isAppRoute,
    isSharedPage,
    isVaultResetRoute,
    isLandingPage
  ]);

  const mainClassName = useMemo(() => {
    const parts = ['kylrix-main-content'];
    if (showLeftSidebar) parts.push('with-sidebar');
    if (isProjectDetailPage) parts.push('project-detail');
    if (isNoteFullPageDetail) parts.push('note-detail');
    return parts.join(' ');
  }, [showLeftSidebar, isProjectDetailPage, isNoteFullPageDetail]);

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

  // Application-wide unhandled error and rejection auto-reporting for engineers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalError = (event: ErrorEvent) => {
      const err = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown client exception');
      void submitRuntimeErrorFeedback({ boundary: 'global', error: err });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Unhandled Promise rejection');
      void submitRuntimeErrorFeedback({ boundary: 'global', error: err });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      if (isDynamicSidebarOpen) closeSidebar();
      if (isOverlayOpen) closeOverlay();
      if (isWalletOpen) closeWallet();
      if (showProUpgrade) closeProUpgrade();
      if (secondarySidebar.isOpen) closeSecondarySidebar();
      // Agentic stays open (stubborn native sidebar) across routes
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
    isDrawerOpen,
    unifiedDrawerActive,
    closeSidebar,
    closeOverlay,
    closeWallet,
    closeProUpgrade,
    closeSecondarySidebar,
    setIsDrawerOpen,
    closeUnified
  ]);

  // 4. Stacking Determinism
  const TOPBAR_Z = 1200;

  return (
    <Box 
        sx={{ 
            minHeight: '100vh', 
            bgcolor: isLandingPage ? '#000000' : '#161412', 
            color: '#fff',
            position: 'relative',
            overflowX: 'hidden'
        }}
    >
      <FABProvider>
      {/* --- LAYER 0: CONTENT & SIDEBAR FLEX ROW --- */}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          minHeight: '100vh',
          pt: isSpecificPostPage ? 0 : { xs: '84px', sm: '88px', md: '96px' },
          position: 'relative'}}
      >
        {showLeftSidebar && <UnifiedLeftSidebar />}

        <Box
          component="main"
          className={mainClassName}
          sx={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            ml: showLeftSidebar ? { xs: 0, sm: 0, md: isCollapsed ? '72px' : '240px' } : 0,
            mr: rightRail?.isOpen
              ? { xs: 0, md: `${rightRail.width}px` }
              : 0,
            position: 'relative',
            zIndex: 1,
            pb: isSpecificPostPage ? 0 : (isLandingPage ? 0 : { xs: 12, md: 4 }),
            px: isLandingPage
              ? 0
              : isProjectDetailPage
                ? { xs: 1, sm: 1, md: 2 }
                : isNoteFullPageDetail
                  ? { xs: 0, sm: 0, md: 0 }
                  : { xs: 1.5, sm: 2, md: 2.5 },
            pointerEvents: 'auto',
            overflowX: 'hidden',
            transition: 'margin 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1)'}}
        >
          {children}
        </Box>

        {rightRail?.isOpen ? (
          <Box
            component="aside"
            aria-label="Secondary panel"
            data-kylrix-native-sidebar
            sx={{
              display: 'flex',
              flexDirection: 'column',
              position: 'fixed',
              top: isSpecificPostPage ? 0 : { xs: '84px', sm: '88px', md: '96px' },
              right: 0,
              bottom: 0,
              width: { xs: '100%', md: rightRail.width },
              zIndex: 20,
              bgcolor: '#161412',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            {rightRail.content}
          </Box>
        ) : null}
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
              pointerEvents: 'none'}}
        >
          <Box sx={{ pointerEvents: 'auto' }}>
              <ConnectTopbar />
          </Box>
        </Box>
      )}

      {isAppRoute && !isSharedPage && !isVaultResetRoute && !isLandingPage && (
        <UnifiedBottomBar />
      )}
      
      </FABProvider>

      <NativeSidebarBridge />

      {/* Mobile + fullscreen chat overlays (edge-to-edge). Desktop detail rail uses NativeSidebarBridge. */}
      {isOverlayOpen && (!isDesktopShell || isCommChatOverlayContent(overlayContent)) && <Overlay />}
      {!isDesktopShell && <AppDynamicSidebarPortal />}

      {/* --- LAYER 2: OVERLAYS --- */}
      {/* Agentic / wallet / unified → NativeSidebarBridge; mobile / modal overlays → UnifiedBottomDrawer */}
      {unifiedDrawerActive !== 'navbar' &&
        (!isDesktopShell ||
          [
            'login',
            'share-context',
            'share-note',
            'zap',
            'delete-confirm',
            'delete-note',
            'security-confirm',
            'access-control',
          ].includes(unifiedDrawerActive as string)) && <UnifiedBottomDrawer />}
      {!isDesktopShell && unifiedDrawerActive === 'flows' && (
        <FlowsDrawer onClose={() => closeUnified()} />
      )}
      {isDesktopShell && unifiedDrawerActive === 'new-chat' && (


        <ChatCreateDrawer open onClose={() => closeUnified()} />
      )}
      {showProUpgrade && <ProUpgradeDrawer />}
      {taskDialogOpen && <TaskDialog />}
      {unifiedDrawerActive === 'note' && <NoteDrawer />}
      {secondarySidebar.isOpen && <RightSidebar />}
      <AccountHealthDrawers />
      {isUnifiedFileDrawerOpen && <UnifiedFileAttachmentDrawer />}
    </Box>
    );
    };

