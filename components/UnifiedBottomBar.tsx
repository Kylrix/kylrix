'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  const [pressedTab, setPressedTab] = useState<string | null>(null);

  // Determine which app we're in
  const appContext = useMemo(() => {
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    return null;
  }, [pathname]);

  // Get app-specific color for selected state
  const appColor = useMemo(() => {
    switch (appContext) {
      case 'vault':
        return '#10B981'; // Emerald
      case 'flow':
        return '#A855F7'; // Amethyst
      case 'connect':
        return '#F59E0B'; // Amber
      case 'note':
      default:
        return '#EC4899'; // Pink
    }
  }, [appContext]);

  // Get current tab based on pathname
  const getCurrentTab = () => {
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
      if (pathname === '/flow' || pathname?.includes('/tasks')) return 'goals';
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
    if (appContext === 'note') {
      const routes: Record<string, string> = {
        notes: '/note/notes',
        shared: '/note/shared',
        tags: '/note/tags',
        projects: '/projects',
      };
      router.push(routes[newValue] || '/note/notes');
    } else if (appContext === 'vault') {
      const routes: Record<string, string> = {
        credentials: '/vault/dashboard',
        sharing: '/vault/sharing',
        totp: '/vault/totp',
        projects: '/projects',
      };
      router.push(routes[newValue] || '/vault/dashboard');
    } else if (appContext === 'flow') {
      const routes: Record<string, string> = {
        goals: '/flow',
        forms: '/flow/forms',
        events: '/flow/events',
        projects: '/projects',
      };
      router.push(routes[newValue] || '/flow');
    } else if (appContext === 'connect') {
      const routes: Record<string, string> = {
        home: '/connect',
        chats: '/connect/chats',
        calls: '/connect/calls',
        projects: '/projects',
      };
      router.push(routes[newValue] || '/connect');
    }
  };

  // Render app-specific navigation
  const renderNavItems = () => {
    if (appContext === 'note') {
      return [
        <BottomNavigationAction
          key="notes"
          value="notes"
          icon={<NotesIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="shared"
          value="shared"
          icon={<SharedIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="tags"
          value="tags"
          icon={<TagsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="projects"
          value="projects"
          icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />];
    }
    if (appContext === 'vault') {
      return [
        <BottomNavigationAction
          key="credentials"
          value="credentials"
          icon={<VaultIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="sharing"
          value="sharing"
          icon={<SharedIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="totp"
          value="totp"
          icon={<TotpIcon size={24} strokeWidth={1.5} className="lucide" />}
        />
,
        <BottomNavigationAction
          key="projects"
          value="projects"
          icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />];
    }
    if (appContext === 'flow') {
      return [
        <BottomNavigationAction
          key="goals"
          value="goals"
          icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="forms"
          value="forms"
          icon={<FormIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="events"
          value="events"
          icon={<EventsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="projects"
          value="projects"
          icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />];
    }
    if (appContext === 'connect') {
      return [
        <BottomNavigationAction
          key="home"
          value="home"
          icon={<HomeIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="chats"
          value="chats"
          icon={<ConnectIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="calls"
          value="calls"
          icon={<CallsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="projects"
          value="projects"
          icon={<ProjectsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />];
    }
    return null;
  };

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isConnectChatPage = pathname?.startsWith('/connect/chats') || pathname?.match(/^\/connect\/chat\/[^/]+$/);
  const isProjectsPage = pathname?.startsWith('/projects');

  const currentTab = getCurrentTab();
  const actions = (() => {
    if (appContext === 'note') {
      return [
        { tab: 'notes', route: '/note/notes', icon: <NotesIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'shared', route: '/note/shared', icon: <SharedIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'tags', route: '/note/tags', icon: <TagsIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'projects', route: '/projects', icon: <ProjectsIcon size={24} strokeWidth={1.5} className="lucide" /> },
      ];
    }
    if (appContext === 'vault') {
      return [
        { tab: 'credentials', route: '/vault/dashboard', icon: <VaultIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'sharing', route: '/vault/sharing', icon: <SharedIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'totp', route: '/vault/totp', icon: <TotpIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'projects', route: '/projects', icon: <ProjectsIcon size={24} strokeWidth={1.5} className="lucide" /> },
      ];
    }
    if (appContext === 'flow') {
      return [
        { tab: 'goals', route: '/flow', icon: <FlowIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'forms', route: '/flow/forms', icon: <FormIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'events', route: '/flow/events', icon: <EventsIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'projects', route: '/projects', icon: <ProjectsIcon size={24} strokeWidth={1.5} className="lucide" /> },
      ];
    }
    if (appContext === 'connect') {
      return [
        { tab: 'home', route: '/connect', icon: <HomeIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'chats', route: '/connect/chats', icon: <ConnectIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'calls', route: '/connect/calls', icon: <CallsIcon size={24} strokeWidth={1.5} className="lucide" /> },
        { tab: 'projects', route: '/projects', icon: <ProjectsIcon size={24} strokeWidth={1.5} className="lucide" /> },
      ];
    }
    return [];
  })();

  // Accounts: never use unified bottom chrome — `/accounts/settings/*` renders its own bottom nav in layout;
  // billing/success/checkout/login and other interim flows should stay full-bleed with no duplicate empty bar.
  if (pathname?.startsWith('/accounts')) return null;

  // Hide bottom bar on settings page, when a real bottom sheet is open, or on full-page note editor
  if (
    isProjectsPage ||
    isConnectChatPage ||
    pathname?.includes('/settings') ||
    activeContent !== 'navbar' ||
    mode === 'compact' ||
    isDrawerOpen ||
    isNoteFullPageDetail ||
    isConnectCallDetail ||
    isCallLauncherOpen || 
    isOverlayOpen
  ) return null;

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
          background: '#161412',
          backgroundImage: 'none', // Remove MUI default overlay
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: 0,
          borderRadius: '24px 24px 0 0',
          px: 2,
          pt: 0.5,
          pb: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <Box
          sx={{
            height: 72,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          {actions.map((a) => {
            const selected = a.tab === currentTab;
            const isPressed = pressedTab === a.tab;

            return (
              <Box
                key={a.tab}
                component="button"
                aria-label={`Open ${a.tab}`}
                onMouseDown={() => setPressedTab(a.tab)}
                onMouseUp={() => setPressedTab(null)}
                onMouseLeave={() => setPressedTab(null)}
                onClick={() => {
                  setPressedTab(null);
                  router.push(a.route);
                }}
                sx={{
                  flex: 1,
                  height: 56,
                  padding: '0 6px',
                  borderRadius: '12px',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  backgroundColor: isPressed
                    ? 'rgba(255,255,255,0.08)'
                    : selected
                      ? `${appColor}1A`
                      : 'transparent',
                  color: selected ? appColor : 'rgba(255, 255, 255, 0.4)',
                  transform: isPressed ? 'scale(0.97)' : undefined,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    transform: selected ? 'scale(1.2) translateY(-2px)' : 'scale(1)',
                    filter: selected ? `drop-shadow(0 0 8px ${appColor}80)` : 'none',
                    transition: 'transform 200ms ease, filter 200ms ease',
                  }}
                >
                  {a.icon}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
