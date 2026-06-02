'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Paper, Tooltip } from '@/lib/mui-tailwind/material';
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

export function UnifiedLeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeContent } = useUnifiedDrawer();
  const { mode } = useAppChrome();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isCallLauncherOpen } = useCallLauncher();
  const { isOpen: isOverlayOpen } = useOverlay();

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

  const handleNavChange = (newValue: string) => {
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

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isConnectChatPage = pathname?.startsWith('/connect/chats') || pathname?.match(/^\/connect\/chat\/[^/]+$/);
  const isProjectsPage = pathname?.startsWith('/projects');

  // Accounts: never use left sidebar
  if (pathname?.startsWith('/accounts')) return null;

  // Hide left sidebar on settings page, when overlays/drawers/compact shells are active
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
    isOverlayOpen ||
    !appContext
  ) return null;

  const currentTab = getCurrentTab();

  const navItems = (() => {
    if (appContext === 'note') {
      return [
        { id: 'notes', label: 'My Notes', icon: NotesIcon },
        { id: 'shared', label: 'Shared Notes', icon: SharedIcon },
        { id: 'tags', label: 'My Tags', icon: TagsIcon },
        { id: 'projects', label: 'All Projects', icon: ProjectsIcon },
      ];
    }
    if (appContext === 'vault') {
      return [
        { id: 'credentials', label: 'My Credentials', icon: VaultIcon },
        { id: 'sharing', label: 'Shared Access', icon: SharedIcon },
        { id: 'totp', label: 'TOTP Generator', icon: TotpIcon },
        { id: 'projects', label: 'All Projects', icon: ProjectsIcon },
      ];
    }
    if (appContext === 'flow') {
      return [
        { id: 'goals', label: 'Flow Goals', icon: FlowIcon },
        { id: 'forms', label: 'Custom Forms', icon: FormIcon },
        { id: 'events', label: 'Smart Events', icon: EventsIcon },
        { id: 'projects', label: 'All Projects', icon: ProjectsIcon },
      ];
    }
    if (appContext === 'connect') {
      return [
        { id: 'home', label: 'Connect Hub', icon: HomeIcon },
        { id: 'chats', label: 'Ecosystem Chats', icon: ConnectIcon },
        { id: 'calls', label: 'Voice Calls', icon: CallsIcon },
        { id: 'projects', label: 'All Projects', icon: ProjectsIcon },
      ];
    }
    return [];
  })();

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        left: 0,
        top: '88px',
        bottom: 0,
        width: 80,
        zIndex: 1100,
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          width: '100%',
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 3,
          boxSizing: 'border-box',
        }}
      >
        <Stack spacing={3.5} sx={{ width: '100%', alignItems: 'center' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentTab === item.id;
            return (
              <Tooltip key={item.id} title={item.label} placement="right" arrow>
                <Box
                  onClick={() => handleNavChange(item.id)}
                  sx={{
                    position: 'relative',
                    width: 48,
                    height: 48,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: isSelected ? appColor : 'rgba(255, 255, 255, 0.4)',
                    bgcolor: isSelected ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: isSelected ? `1px solid ${appColor}33` : '1px solid transparent',
                    '&:hover': {
                      color: isSelected ? appColor : '#fff',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      transform: 'translateY(-1px)',
                      ...(isSelected ? {} : { borderColor: 'rgba(255,255,255,0.08)' }),
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                    },
                  }}
                >
                  {/* Glowing vertical indicator edge */}
                  {isSelected && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -16,
                        width: 4,
                        height: 24,
                        borderRadius: '0 4px 4px 0',
                        bgcolor: appColor,
                        boxShadow: `0 0 12px ${appColor}`,
                      }}
                    />
                  )}

                  <Icon
                    size={22}
                    strokeWidth={1.5}
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      ...(isSelected && {
                        transform: 'scale(1.1)',
                        filter: `drop-shadow(0 0 6px ${appColor}60)`,
                      }),
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
}

// Inline Stack Component to avoid separate imports if not present
function Stack({ children, spacing, sx }: { children: React.ReactNode; spacing: number; sx?: any }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${spacing * 8}px`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
