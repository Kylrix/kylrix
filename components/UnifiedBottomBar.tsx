'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@/lib/openbricks/primitives';
import {
  FileText as NotesIcon,
  Lock as VaultIcon,
  CheckSquare as FlowIcon,
  MessageCircle as ConnectIcon,
  FolderKanban as ProjectsIcon,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';

/**
 * Persistent unified app-specific bottom bar.
 * Shows five item icons: note, flow, vault, connect, projects in that order.
 * Attached to bottom with full width, curved top corners.
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
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/projects')) return 'projects';
    return null;
  }, [pathname]);

  const appColor = useMemo(() => {
    switch (appContext) {
      case 'vault':
        return '#10B981';
      case 'flow':
        return '#A855F7';
      case 'connect':
        return '#F59E0B';
      case 'projects':
        return '#6366F1';
      case 'note':
      default:
        return '#EC4899';
    }
  }, [appContext]);

  const getCurrentTab = () => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/projects')) return 'projects';
    return null;
  };

  React.useEffect(() => {
    ['/app', '/flow', '/vault', '/connect', '/projects'].forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    const routes: Record<string, string> = {
      note: '/app',
      flow: '/flow',
      vault: '/vault',
      connect: '/connect',
      projects: '/projects',
    };
    
    const target = routes[newValue];
    if (!target) return;

    if (newValue === getCurrentTab()) {
      if (pathname !== target) router.replace(target);
      return;
    }

    router.push(target);
  };

  const renderNavItems = () => {
    return [
      <BottomNavigationAction key="note" value="note" icon={<NotesIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      <BottomNavigationAction key="flow" value="flow" icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      <BottomNavigationAction key="vault" value="vault" icon={<VaultIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      <BottomNavigationAction key="connect" value="connect" icon={<ConnectIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      <BottomNavigationAction key="projects" value="projects" icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
    ];
  };

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/app\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isSpecificChatPage = Boolean(pathname?.match(/^\/connect\/chat\/[^/]+$/));
  const isSpecificPostPage = Boolean(pathname?.match(/^\/connect\/post\/[^/]+$/));
  const isSpecificProjectPage = Boolean(pathname?.match(/^\/projects\/[^/]+$/));
  const isPublicFormPage = Boolean(pathname?.match(/^\/flow\/form\/[^/]+$/));
  const isSharedNotePage = Boolean(pathname?.startsWith('/app/shared') || pathname?.startsWith('/idea'));

  const contextMenu = useContextMenu();

  if (pathname?.startsWith('/accounts')) return null;

  if (
    isSpecificChatPage ||
    isSpecificProjectPage ||
    isPublicFormPage ||
    isSpecificPostPage ||
    isSharedNotePage ||
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
        display: { xs: 'block', md: 'none' },
      }}
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
          px: 2,
          pt: 0.5,
          pb: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <BottomNavigation
          value={getCurrentTab()}
          onChange={handleNavChange}
          actionColor={appColor}
          showLabels={false}
          sx={{
            backgroundColor: 'transparent',
            height: 72,
            width: '100%',
          }}
        >
          {renderNavItems()}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
