'use client';

import React, { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { DesktopSidebar } from './Navigation';
import { useSidebar } from './ui/SidebarContext';
import { useDynamicSidebar } from './ui/DynamicSidebarContext';
import { UnifiedBottomBar } from './UnifiedBottomBar';
import NoteTopbar from '@/components/common/NoteTopbar';
import { DISABLE_GLOBAL_HEALTH_OVERHEAD } from '@/lib/dev/disable-global-health-overhead';

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
const AccountHealthDrawers = dynamic(
  () =>
    import('@/components/onboarding/AccountHealthDrawers').then((m) => ({
      default: m.AccountHealthDrawers,
    })),
  { ssr: false }
);

export default function GlobalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
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

  React.useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean }>;
      setHideDesktopSidebar(Boolean(custom.detail?.open));
    };

    window.addEventListener('kylrix-topbar-sidebar', handler as EventListener);
    return () => window.removeEventListener('kylrix-topbar-sidebar', handler as EventListener);
  }, []);
  
  // If it's a shared note page, we might want a different shell
  const isSharedPage = pathname?.includes('/shared/');
  const isVaultResetRoute = pathname?.startsWith('/vault/reset');
  
  /** Full-page note at /note/notes/[id] — bottom tabs clash with editor chrome; list/shared/tags still get the bar. */
  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));

  const shouldShowBottomBar = Boolean(
    isAppRoute &&
      !isVaultResetRoute &&
      !isSharedPage &&
      pathname !== '/note' &&
      pathname !== '/settings' &&
      !isNoteFullPageDetail &&
      !isConnectCallDetail &&
      (!pathname?.startsWith('/vault') || pathname?.startsWith('/vault/dashboard'))
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      {/* /(app) routes get UnifiedTopbar from app/(app)/layout.tsx; website pages share the landing topbar */}
      {isWebsiteRoute && (
        <Suspense fallback={null}>
          <NoteTopbar />
        </Suspense>
      )}
      
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

      {isAppRoute && !isSharedPage && !isVaultResetRoute && <DynamicSidebar />}
      {shouldShowBottomBar && <UnifiedBottomBar />}
      <AgenticDrawer />
      <ProUpgradeDrawer />
      {isAppRoute && !isSharedPage && !isVaultResetRoute && !DISABLE_GLOBAL_HEALTH_OVERHEAD ? (
        <AccountHealthDrawers />
      ) : null}
    </Box>
  );
}
