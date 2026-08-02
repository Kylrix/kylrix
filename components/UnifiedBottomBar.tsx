'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper} from '@/lib/openbricks/primitives';
import {
  FileText as NotesIcon,
  Target as GoalsIcon,
  Lock as VaultIcon,
  GitFork as FlowIcon,
  MessageCircle as ConnectIcon} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { isFlowPath } from '@/lib/routing/app-paths';

/**
 * Persistent unified bottom bar.
 * Order: idea → goal → vault → connect → flows
 */
export function UnifiedBottomBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeContent } = useUnifiedDrawer();
  const { mode } = useAppChrome();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isCallLauncherOpen } = useCallLauncher();
  const { isOpen: isOverlayOpen } = useOverlay();

  const appContext = useMemo(() => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/events') || pathname?.startsWith('/goal')) return 'goal';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (isFlowPath(pathname)) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    return null;
  }, [pathname]);

  const appColor = useMemo(() => {
    switch (appContext) {
      case 'vault':
        return '#10B981';
      case 'goal':
        return '#A855F7';
      case 'flow':
        return '#A855F7';
      case 'connect':
        return '#F59E0B';
      case 'note':
      default:
        return '#EC4899';
    }
  }, [appContext]);

  const getCurrentTab = () => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/events') || pathname?.startsWith('/goal')) return 'goal';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (isFlowPath(pathname)) return 'flow';
    return null;
  };

  React.useEffect(() => {
    ['/app', '/goals', '/vault', '/connect', '/flows'].forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    const routes: Record<string, string> = {
      note: '/app',
      goal: '/goals',
      vault: '/vault',
      connect: '/connect',
      flow: '/flows',
    };

    const target = routes[newValue];
    if (!target) return;

    if (newValue === getCurrentTab()) {
      if (pathname !== target) router.replace(target);
      return;
    }

    router.push(target);
  };

  const renderNavItems = () => [
    <BottomNavigationAction key="note" value="note" icon={<NotesIcon size={22} strokeWidth={1.5} className="lucide" />} />,
    <BottomNavigationAction key="goal" value="goal" icon={<GoalsIcon size={22} strokeWidth={1.5} className="lucide" />} />,
    <BottomNavigationAction key="vault" value="vault" icon={<VaultIcon size={22} strokeWidth={1.5} className="lucide" />} />,
    <BottomNavigationAction key="connect" value="connect" icon={<ConnectIcon size={22} strokeWidth={1.5} className="lucide" />} />,
    <BottomNavigationAction key="flow" value="flow" icon={<FlowIcon size={22} strokeWidth={1.5} className="lucide" />} />,
  ];

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/app\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isSpecificChatPage = Boolean(pathname?.match(/^\/connect\/chat\/[^/]+$/));
  const isConnectChatsSurface = Boolean(
    pathname === '/connect/chats' || pathname?.startsWith('/connect/chats/'),
  );
  const isSpecificPostPage = Boolean(pathname?.match(/^\/connect\/post\/[^/]+$/));
  const isSpecificProjectPage = Boolean(pathname?.match(/^\/workspaces\/[^/]+$/));
  const isPublicFormPage = Boolean(pathname?.match(/^\/form\/[^/]+$/));
  // Public idea pages only — do not hide chrome on /app home
  const isPublicIdeaPage = Boolean(pathname?.match(/^\/idea(\/|$)/));

  const contextMenu = useContextMenu();

  if (pathname?.startsWith('/accounts')) return null;

  if (
    isSpecificChatPage ||
    isConnectChatsSurface ||
    isSpecificProjectPage ||
    isPublicFormPage ||
    isSpecificPostPage ||
    isPublicIdeaPage ||
    pathname?.includes('/settings') ||
    activeContent !== 'navbar' ||
    mode === 'compact' ||
    isDrawerOpen ||
    isNoteFullPageDetail ||
    isConnectCallDetail ||
    isCallLauncherOpen ||
    isOverlayOpen ||
    contextMenu?.isOpen
  ) {
    return null;
  }

  return (
    <Box
      component="footer"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        display: { xs: 'block', md: 'none' }}}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          bgcolor: '#161412',
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: 0,
          borderRadius: '24px 24px 0 0',
          px: 1.5,
          pt: 0.5,
          pb: 'max(0.5rem, env(safe-area-inset-bottom))'}}
      >
        <BottomNavigation
          value={getCurrentTab()}
          onChange={handleNavChange}
          actionColor={appColor}
          showLabels={false}
          sx={{
            backgroundColor: 'transparent',
            height: 72,
            width: '100%'}}
        >
          {renderNavItems()}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
