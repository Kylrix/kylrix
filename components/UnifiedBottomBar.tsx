'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@/lib/mui-tailwind/material';
import {
  FileText as NotesIcon,
  Share2 as SharedIcon,
  Tag as TagsIcon,
  FolderKanban as ProjectsIcon,
  Lock as VaultIcon,
  Shield as TotpIcon,
  CheckSquare as FlowIcon,
  FileText as FormIcon,
  Zap as EventsIcon,
  MessageCircle as ConnectIcon,
  Home as HomeIcon,
  Phone as CallsIcon,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useOverlay } from '@/components/ui/OverlayContext';

/**
 * Persistent unified app-specific bottom bar.
 * Shows different icons/tabs based on which app you're in.
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
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/projects')) return 'note'; // Default to Note context for Projects hub
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
      case 'note':
      default:
        return '#EC4899';
    }
  }, [appContext]);

  const getCurrentTab = () => {
    if (pathname?.startsWith('/projects')) return 'projects';

    if (appContext === 'note') {
      if (pathname?.includes('/shared')) return 'shared';
      if (pathname?.includes('/tags')) return 'tags';
      return 'notes';
    }
    if (appContext === 'vault') {
      if (pathname?.includes('/sharing')) return 'sharing';
      if (pathname?.includes('/totp')) return 'totp';
      return 'credentials';
    }
    if (appContext === 'flow') {
      if (pathname?.includes('/forms')) return 'forms';
      if (pathname?.includes('/events')) return 'events';
      return 'goals';
    }
    if (appContext === 'connect') {
      if (pathname?.includes('/chats')) return 'chats';
      if (pathname?.includes('/calls')) return 'calls';
      return 'home';
    }
    return null;
  };

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    const routes: Record<string, Record<string, string>> = {
      note: { notes: '/note/notes', shared: '/note/shared', tags: '/note/tags', projects: '/projects' },
      vault: { credentials: '/vault/dashboard', sharing: '/vault/sharing', totp: '/vault/totp', projects: '/projects' },
      flow: { goals: '/flow/tasks', forms: '/flow/forms', events: '/flow/events', projects: '/projects' },
      connect: { home: '/connect', chats: '/connect/chats', calls: '/connect/calls', projects: '/projects' },
    };
    
    const context = appContext || 'note';
    const target = routes[context]?.[newValue];
    if (!target) return;

    const current = pathname || '';
    if (current === target || current.startsWith(`${target}/`)) return;

    router.push(target);
  };

  const renderNavItems = () => {
    const context = appContext || 'note';
    if (context === 'note') {
      return [
        <BottomNavigationAction key="notes" value="notes" icon={<NotesIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="shared" value="shared" icon={<SharedIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="tags" value="tags" icon={<TagsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="projects" value="projects" icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      ];
    }
    if (context === 'vault') {
      return [
        <BottomNavigationAction key="credentials" value="credentials" icon={<VaultIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="sharing" value="sharing" icon={<SharedIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="totp" value="totp" icon={<TotpIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="projects" value="projects" icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      ];
    }
    if (context === 'flow') {
      return [
        <BottomNavigationAction key="goals" value="goals" icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="forms" value="forms" icon={<FormIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="events" value="events" icon={<EventsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="projects" value="projects" icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      ];
    }
    if (context === 'connect') {
      return [
        <BottomNavigationAction key="home" value="home" icon={<HomeIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="chats" value="chats" icon={<ConnectIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="calls" value="calls" icon={<CallsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
        <BottomNavigationAction key="projects" value="projects" icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />} />,
      ];
    }
    return null;
  };

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isSpecificChatPage = Boolean(pathname?.match(/^\/connect\/chat\/[^/]+$/));
  const isSpecificProjectPage = Boolean(pathname?.match(/^\/projects\/[^/]+$/));
  const isPublicFormPage = Boolean(pathname?.match(/^\/flow\/form\/[^/]+$/));

  if (pathname?.startsWith('/accounts')) return null;
  if (pathname?.startsWith('/projects') || pathname?.startsWith('/teams')) return null;

  if (
    isSpecificChatPage ||
    isSpecificProjectPage ||
    isPublicFormPage ||
    pathname?.includes('/settings') ||
    activeContent !== 'navbar' ||
    mode === 'compact' ||
    isDrawerOpen ||
    isNoteFullPageDetail ||
    isConnectCallDetail ||
    isCallLauncherOpen ||
    isOverlayOpen
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
