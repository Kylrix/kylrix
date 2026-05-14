'use client';

import React, { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { DesktopSidebar } from './Navigation';
import { useSidebar } from './ui/SidebarContext';
import { useDynamicSidebar } from './ui/DynamicSidebarContext';
import { UnifiedBottomBar } from './UnifiedBottomBar';
import { UnifiedTopbar } from '@/components/UnifiedTopbar';
import { DISABLE_GLOBAL_HEALTH_OVERHEAD } from '@/lib/dev/disable-global-health-overhead';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';
import { useAuth } from '@/context/auth/AuthContext';

const DynamicSidebar = dynamic(
  () => import('./ui/DynamicSidebarPanel').then((m) => ({ default: m.DynamicSidebar })),
  { ssr: false }
);
const LoginDrawer = dynamic(
  () => import('./overlays/LoginDrawer').then((m) => ({ default: m.LoginDrawer })),
  { ssr: false }
);
const AgenticDrawer = dynamic(
  () => import('./overlays/AgenticDrawer').then((m) => ({ default: m.AgenticDrawer })),
  { ssr: false }
);
const AccountHealthDrawers = dynamic(
  () =>
    import('@/components/onboarding/AccountHealthDrawers').then((m) => ({
      default: m.AccountHealthDrawers,
    })),
  { ssr: false }
);

function AgenticDrawerMount() {
  const { isOpen } = useAgenticDrawer();
  return <AgenticDrawer />;
}

function ProUpgradeDrawerMount() {
  const { showProUpgrade } = useProUpgrade();
  return <ProUpgradeDrawer />;
}

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  React.useEffect(() => {
    async function ensureDailyLoginMint() {
      if (!user?.$id) return;
      
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayKey = today.toISOString();
      
      const lastLogin = localStorage.getItem('kylrix_last_login_mint');
      if (lastLogin === todayKey) return; // Already minted today
      
      try {
        const { runTokenOperationSecure } = await import('@/lib/actions/secure-ops');
        await runTokenOperationSecure({
          action: 'mint_activity',
          userId: user.$id,
          idempotencyKey: `mint:daily_login:${todayKey}:${user.$id}`,
          activityType: 'daily_login',
          uniqueActors: 1,
          trustScore: 70,
          sourceType: 'daily_login',
          sourceId: todayKey,
        });
        
        localStorage.setItem('kylrix_last_login_mint', todayKey);
      } catch (err) {
        console.warn('[Token] Daily login mint failed:', err);
      }
    }
    
    void ensureDailyLoginMint();
  }, [user?.$id]);
  const isAppRoute = Boolean(
    pathname?.startsWith('/note') ||
    pathname?.startsWith('/vault') ||
    pathname?.startsWith('/flow') ||
    pathname?.startsWith('/connect') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/settings')
  );
  const isWebsiteRoute = !isAppRoute;
  const { isCollapsed } = useSidebar();
  const [hideDesktopSidebar, setHideDesktopSidebar] = React.useState(false);
  const { isOpen: isDynamicSidebarOpen } = useDynamicSidebar();
  const [mountDynamicSidebar, setMountDynamicSidebar] = React.useState(false);
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();
  const { closeWallet } = useWalletOverlay();
  const { closeAgenticDrawer } = useAgenticDrawer();
  const { closeProUpgrade } = useProUpgrade();

  React.useEffect(() => {
    closeSidebar();
    closeOverlay();
    closeWallet();
    closeAgenticDrawer();
    closeProUpgrade();
  }, [pathname, closeAgenticDrawer, closeOverlay, closeProUpgrade, closeSidebar, closeWallet]);

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
  const isSharedPage = pathname?.includes('/shared/');
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  
  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isConnectChatDetail = Boolean(pathname?.match(/^\/connect\/chat\/[^/]+$/));

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
      <LoginDrawer />
      {/**
       * Single persistent topbar for the entire app + marketing surface. UnifiedTopbar
       * already swaps its skin/content by pathname, so we mount it once here. App routes
       * used to mount it via app/(app)/layout.tsx — that wrapper is now redundant and
       * the topbar's React identity stays stable across website ↔ app navigation.
       */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <Suspense fallback={null}>
          <UnifiedTopbar />
        </Suspense>
      </Box>

      {isAppRoute && !isSharedPage && !isVaultResetRoute && !hideDesktopSidebar && <DesktopSidebar />}
      
      <Box
        component="main"
        sx={{
          minWidth: 0,
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
      <AgenticDrawerMount />
      <ProUpgradeDrawerMount />
      {isAppRoute && !isSharedPage && !isVaultResetRoute && !DISABLE_GLOBAL_HEALTH_OVERHEAD && (
        <AccountHealthDrawers />
      )}
    </Box>
  );
}
