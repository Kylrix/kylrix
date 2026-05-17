'use client';

import React, { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { DesktopSidebar } from './Navigation';
import RightSidebar from './layout/RightSidebar';
import { useSidebar } from './ui/SidebarContext';
import { useDynamicSidebar } from './ui/DynamicSidebarContext';
import { UnifiedBottomBar } from './UnifiedBottomBar';
import ConnectTopbar from '@/components/layout/ConnectTopbar';
import { DISABLE_GLOBAL_HEALTH_OVERHEAD } from '@/lib/dev/disable-global-health-overhead';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import Overlay from '@/components/ui/Overlay';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useAuth } from '@/context/auth/AuthContext';

const DynamicSidebar = dynamic(
  () => import('./ui/DynamicSidebarPanel').then((m) => ({ default: m.DynamicSidebar })),
  { ssr: false }
);
const ProUpgradeDrawer = dynamic(
  () => import('./overlays/ProUpgradeDrawer').then((m) => ({ default: m.ProUpgradeDrawer })),
  { ssr: false }
);
const AgenticDrawer = dynamic(
  () => import('./overlays/AgenticDrawer').then((m) => ({ default: m.AgenticDrawer })),
  { ssr: false }
);
const UnifiedBottomDrawer = dynamic(
  () => import('./overlays/UnifiedBottomDrawer').then((m) => ({ default: m.UnifiedBottomDrawer })),
  { ssr: false }
);
const AccountHealthDrawers = dynamic(
  () =>
    import('@/components/onboarding/AccountHealthDrawers').then((m) => ({
      default: m.AccountHealthDrawers,
    })),
  { ssr: false }
);

const GlobalFAB = dynamic(() => import('./layout/GlobalFAB'), { ssr: false });
const TaskDialog = dynamic(() => import('@/components/tasks/TaskDialog'), { ssr: false });

function ProUpgradeDrawerMount() {
  const { showProUpgrade } = useProUpgrade();
  if (!showProUpgrade) return null;
  return <ProUpgradeDrawer />;
}

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const isAppRoute = Boolean(
    pathname?.startsWith('/note') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  );
  const isWebsiteRoute = !isAppRoute;
  const isSharedPage = pathname?.includes('/shared/');
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  
  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isConnectChatDetail = Boolean(pathname?.match(/^\/connect\/chat\/[^/]+$/));
  const { isCollapsed } = useSidebar();
  const [hideDesktopSidebar, setHideDesktopSidebar] = React.useState(false);
  const { isOpen: isDynamicSidebarOpen } = useDynamicSidebar();
  const [mountDynamicSidebar, setMountDynamicSidebar] = React.useState(false);
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();
  const { closeWallet } = useWalletOverlay();
  const { closeAgenticDrawer } = useAgenticDrawer();
  const { closeProUpgrade } = useProUpgrade();
  const { open: openUnified } = useUnifiedDrawer();

  React.useEffect(() => {
    if (!isLoading && !user && isAppRoute && !isSharedPage) {
      openUnified('login');
    }
  }, [isLoading, user, isAppRoute, isSharedPage, openUnified]);

  React.useEffect(() => {
    // Consolidate all interaction closures into a single batch to prevent re-render storms on navigation
    closeSidebar();
    closeOverlay();
    closeWallet();
    closeAgenticDrawer();
    closeProUpgrade();
  }, [pathname, closeSidebar, closeOverlay, closeWallet, closeAgenticDrawer, closeProUpgrade]);

  React.useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean }>;
      setHideDesktopSidebar(Boolean(custom.detail?.open));
    };

    window.addEventListener('kylrix-topbar-sidebar', handler as EventListener);
    return () => window.removeEventListener('kylrix-topbar-sidebar', handler as EventListener);
  }, []);

  React.useEffect(() => {
    if (isDynamicSidebarOpen) {
      setMountDynamicSidebar(true);
      return;
    }
    const unmountTimer = window.setTimeout(() => {
      setMountDynamicSidebar(false);
    }, 320);
    return () => window.clearTimeout(unmountTimer);
  }, [isDynamicSidebarOpen]);
  
  // If it's a shared note page, we might want a different shell

  const shouldShowBottomBar = Boolean(
    isAppRoute &&
      !isVaultResetRoute &&
      !isSharedPage &&
      pathname !== '/note' &&
      pathname !== '/settings' &&
      !isNoteFullPageDetail &&
      !isConnectCallDetail &&
      !isConnectChatDetail &&
      (!pathname?.startsWith('/vault') || pathname?.startsWith('/vault/dashboard'))
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      <Overlay />
      <UnifiedBottomDrawer />
      {/** 
       * Global Chrome Layer (Z: 1000+)
       * ConnectTopbar handles its own AppBar (Z: 1201).
       * We wrap it in pointer-events: none to ensure the 100vw box doesn't shield the page.
       */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, pointerEvents: 'none' }}>
        <Suspense fallback={null}>
          <ConnectTopbar />
        </Suspense>
      </Box>

      {isAppRoute && !isSharedPage && !isVaultResetRoute && !hideDesktopSidebar && (
        <Box sx={{ zIndex: 1100, position: 'relative' }}>
          <DesktopSidebar />
        </Box>
      )}
      <RightSidebar />
      
      <Box
        component="main"
        sx={{
          minWidth: 0,
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1,
          pt: '88px',
          pb: isWebsiteRoute ? 0 : { xs: 12, md: 4 },
          // Avoid `transition: all` — it animates every property and can jank main-thread layout.
          transition: 'margin 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          ml: (isAppRoute && !isSharedPage) ? {
            md: hideDesktopSidebar ? 0 : (isCollapsed ? '80px' : '280px')
          } : 0,
          mr: isDynamicSidebarOpen ? { md: '28rem', lg: '32rem' } : 0
        }}
      >
        {children}
      </Box>

      {isAppRoute && !isSharedPage && !isVaultResetRoute && mountDynamicSidebar && <DynamicSidebar />}
      {shouldShowBottomBar && <UnifiedBottomBar />}
      <ProUpgradeDrawerMount />
      <GlobalFAB />
      <TaskDialog />
      {isAppRoute && !isSharedPage && !isVaultResetRoute && !DISABLE_GLOBAL_HEALTH_OVERHEAD && (
        <AccountHealthDrawers />
      )}
    </Box>
  );
}
