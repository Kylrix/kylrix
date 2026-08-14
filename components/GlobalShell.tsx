'use client';

import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box } from '@/lib/openbricks/primitives';

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
import { useRightRailOptional } from '@/context/RightRailContext';
import { NativeSidebarBridge } from '@/components/layout/NativeSidebarBridge';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { FABProvider } from '@/context/FABContext';
import UniversalFAB from '@/components/layout/UniversalFAB';

import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { isFlowPath, isGoalsSurfacePath } from '@/lib/routing/app-paths';

import { UnifiedLeftSidebar } from '@/components/UnifiedLeftSidebar';

// Lazy Components
const UnifiedBottomDrawer = dynamic(() => import('./overlays/UnifiedBottomDrawer').then(m => m.UnifiedBottomDrawer), { ssr: false });
const MomentComposerDrawer = dynamic(
  () => import('./overlays/MomentComposerDrawer').then((m) => m.MomentComposerDrawer),
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
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  React.useEffect(() => {
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
  const { user, isLoading } = useAuth();
  const isDesktopShell = useIsDesktopShell();
  
  // 0. Aggressive Optimization Hooks
  useServiceWorker();

  // 1. Route Analysis
  const isAppRoute = useMemo(() => Boolean(
    pathname?.startsWith('/app') ||
    isFlowPath(pathname) ||
    isGoalsSurfacePath(pathname) ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/tags') ||
    pathname?.startsWith('/trash') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  ), [pathname]);

  const isSharedPage = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.includes('/shared/') ||
      pathname.startsWith('/goal/') ||
      pathname.startsWith('/form/') ||
      pathname.startsWith('/events/') ||
      pathname.startsWith('/connect/call/') ||
      pathname.startsWith('/agents/session/') ||
      pathname.startsWith('/agents/chat/') ||
      pathname.startsWith('/send') ||
      pathname.startsWith('/i/') ||
      pathname.startsWith('/u/')
    );
  }, [pathname]);
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  const isLandingPage = pathname === '/';

  // 2. UI State
  const { activeContent: unifiedDrawerActive, open: openUnified, close: closeUnified } = useUnifiedDrawer();
  const { showProUpgrade, closeProUpgrade } = useProUpgrade();
  const { taskDialogOpen } = useTask();
  const { secondarySidebar, closeSecondarySidebar } = useLayout();
  const { isOpen: isOverlayOpen, closeOverlay } = useOverlay();
  const { isOpen: isDynamicSidebarOpen, closeSidebar } = useDynamicSidebar();
  const { isCollapsed } = useSidebarContext();
  const rightRail = useRightRailOptional();
  const { isWalletOpen, closeWallet } = useWalletOverlay();
  const { } = useAppChrome();
  const { isDrawerOpen, setIsDrawerOpen } = useDrawerState();
  const { } = useCallLauncher();

  // Smart responsive Left Sidebar visibility
  const isNoteFullPageDetail = useMemo(
    () => Boolean(pathname?.match(/^\/idea\/[^/]+$/)),
    [pathname]);

  const isChatSurface = useMemo(
    () => Boolean(pathname === '/connect/chats' || pathname?.match(/^\/connect\/chats\/[^/]+$/)),
    [pathname],
  );

const isSpecificPostPage = useMemo(
    () =>
      Boolean(
        pathname?.startsWith('/connect/post/') || pathname?.startsWith('/moment/'),
      ),
    [pathname],
  );
  const isProjectDetailPage = useMemo(() => Boolean(pathname?.match(/^\/workspace\/[^/]+$/)), [pathname]);

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
    if (isChatSurface) parts.push('chat-surface');
    return parts.join(' ');
  }, [showLeftSidebar, isProjectDetailPage, isNoteFullPageDetail, isChatSurface]);

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
            bgcolor: '#000000', 
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
            pb: isSpecificPostPage || isChatSurface ? 0 : (isLandingPage ? 0 : { xs: 12, md: 4 }),
            px: isProjectDetailPage
              ? { xs: 1, sm: 1, md: 2 }
              : isNoteFullPageDetail || isChatSurface
                ? { xs: 0, sm: 0, md: 0 }
                : { xs: 1.5, sm: 2, md: 2.5 },
            pointerEvents: 'auto',
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
      
      {!isSharedPage && <UniversalFAB />}

      </FABProvider>

      <NativeSidebarBridge />

      {/* Mobile only: edge-to-edge drawers. Desktop details → native right rail. */}
      {!isDesktopShell && isOverlayOpen && <Overlay />}
      {!isDesktopShell && <AppDynamicSidebarPortal />}

      {/* --- LAYER 2: OVERLAYS --- */}
      {/* Agentic / wallet / unified → NativeSidebarBridge; mobile / modal overlays → UnifiedBottomDrawer */}
      {unifiedDrawerActive !== 'navbar' && (!isDesktopShell || unifiedDrawerActive === 'login') && <UnifiedBottomDrawer />}
      {unifiedDrawerActive === 'moment-composer' && (
        <MomentComposerDrawer onClose={() => closeUnified()} />
      )}
      {isDesktopShell && unifiedDrawerActive === 'new-chat' && (
        <ChatCreateDrawer open onClose={() => closeUnified()} />
      )}
      {showProUpgrade && <ProUpgradeDrawer />}
      {taskDialogOpen && <TaskDialog />}
      {unifiedDrawerActive === 'note' && <NoteDrawer />}
      {secondarySidebar.isOpen && <RightSidebar />}
      <AccountHealthDrawers />
      <UnifiedFileAttachmentDrawer />
    </Box>
    );
    };

