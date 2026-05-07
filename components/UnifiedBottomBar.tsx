'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import {
  FileText as NotesIcon,
  Share2 as SharedIcon,
  Tag as TagsIcon,
  Settings as SettingsIcon,
  Lock as VaultIcon,
  Upload as ImportIcon,
  CheckSquare as FlowIcon,
  MessageCircle as ConnectIcon,
  Home as HomeIcon,
  Phone as CallsIcon,
} from 'lucide-react';

/**
 * Persistent unified app-specific bottom bar.
 * Shows different icons/tabs based on which app you're in.
 * Attached to bottom with full width, curved top corners.
 */
export function UnifiedBottomBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Determine which app we're in
  const appContext = useMemo(() => {
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
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
      case 'accounts':
        return '#6366F1'; // Indigo
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
      if (pathname?.includes('/settings')) return 'settings';
      return 'notes';
    }
    if (appContext === 'vault') {
      if (pathname?.includes('/credentials')) return 'credentials';
      if (pathname?.includes('/import')) return 'import';
      if (pathname?.includes('/settings')) return 'settings';
      return 'overview';
    }
    if (appContext === 'flow') {
      if (pathname?.includes('/calendar')) return 'calendar';
      if (pathname?.includes('/tasks')) return 'tasks';
      if (pathname?.includes('/settings')) return 'settings';
      return 'overview';
    }
    if (appContext === 'connect') {
      if (pathname?.includes('/chats')) return 'chats';
      if (pathname?.includes('/calls')) return 'calls';
      if (pathname?.includes('/settings')) return 'settings';
      return 'home';
    }
    if (appContext === 'accounts') {
      if (pathname?.includes('/settings')) return 'settings';
      return 'overview';
    }
    return null;
  };

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    if (appContext === 'note') {
      const routes: Record<string, string> = {
        notes: '/note/notes',
        shared: '/note/shared',
        tags: '/note/tags',
        settings: '/settings',
      };
      router.push(routes[newValue] || '/note/notes');
    } else if (appContext === 'vault') {
      const routes: Record<string, string> = {
        overview: '/vault',
        credentials: '/vault/credentials',
        import: '/vault/import',
        settings: '/settings',
      };
      router.push(routes[newValue] || '/vault');
    } else if (appContext === 'flow') {
      const routes: Record<string, string> = {
        overview: '/flow',
        calendar: '/flow/calendar',
        tasks: '/flow/tasks',
        settings: '/settings',
      };
      router.push(routes[newValue] || '/flow');
    } else if (appContext === 'connect') {
      const routes: Record<string, string> = {
        home: '/connect',
        chats: '/connect/chats',
        calls: '/connect/calls',
        settings: '/settings',
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
          key="settings"
          value="settings"
          icon={<SettingsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
      ];
    }
    if (appContext === 'vault') {
      return [
        <BottomNavigationAction
          key="overview"
          value="overview"
          icon={<VaultIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="credentials"
          value="credentials"
          icon={<NotesIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="import"
          value="import"
          icon={<ImportIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="settings"
          value="settings"
          icon={<SettingsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
      ];
    }
    if (appContext === 'flow') {
      return [
        <BottomNavigationAction
          key="overview"
          value="overview"
          icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="tasks"
          value="tasks"
          icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="calendar"
          value="calendar"
          icon={<TagsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
        <BottomNavigationAction
          key="settings"
          value="settings"
          icon={<SettingsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
      ];
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
          key="settings"
          value="settings"
          icon={<SettingsIcon size={24} strokeWidth={1.5} className="lucide" />}
        />,
      ];
    }
    return null;
  };

  if (!appContext) return null;

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
          showLabels={false}
          sx={{
            backgroundColor: 'transparent',
            height: 72,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '0',
              color: 'rgba(255, 255, 255, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                color: appColor,
                '& .lucide': {
                  transform: 'scale(1.2) translateY(-2px)',
                  filter: `drop-shadow(0 0 8px ${appColor}80)`,
                }
              },
            },
          }}
        >
          {renderNavItems()}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
