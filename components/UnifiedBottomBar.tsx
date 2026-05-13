'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Shield as ShieldIcon,
  CheckSquare as FlowIcon,
  FileText as FormIcon,
  Zap as EventsIcon,
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
  const [hasBottomDrawerOpen, setHasBottomDrawerOpen] = useState(false);

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
      if (pathname?.includes('/settings')) return 'settings';
      return 'notes';
    }
    if (appContext === 'vault') {
      if (pathname?.includes('/sharing')) return 'sharing';
      if (pathname?.includes('/totp')) return 'totp';
      if (pathname?.includes('/settings')) return 'settings';
      return 'credentials';
    }
    if (appContext === 'flow') {
      if (pathname?.includes('/forms')) return 'forms';
      if (pathname?.includes('/events')) return 'events';
      if (pathname?.includes('/settings')) return 'settings';
      if (pathname === '/flow' || pathname?.includes('/tasks')) return 'goals';
      return 'goals';
    }
    if (appContext === 'connect') {
      if (pathname?.includes('/chats')) return 'chats';
      if (pathname?.includes('/calls')) return 'calls';
      if (pathname?.includes('/settings')) return 'settings';
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
        settings: '/settings',
      };
      router.push(routes[newValue] || '/note/notes');
    } else if (appContext === 'vault') {
      const routes: Record<string, string> = {
        credentials: '/vault/dashboard',
        sharing: '/vault/sharing',
        totp: '/vault/totp',
        settings: '/vault/settings',
      };
      router.push(routes[newValue] || '/vault/dashboard');
    } else if (appContext === 'flow') {
      const routes: Record<string, string> = {
        goals: '/flow',
        forms: '/flow/forms',
        events: '/flow/events',
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
          icon={<ShieldIcon size={24} strokeWidth={1.5} className="lucide" />}
        />
,
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

  useEffect(() => {
    const evaluateDrawerState = () => {
      if (typeof document === 'undefined') return;
      /** Only count *visible* bottom-anchor MUI drawers. keepMounted + loose aria-hidden caused false positives and hid this bar on /note/notes. */
      const modals = document.querySelectorAll('.MuiModal-root');
      let open = false;
      modals.forEach((modal) => {
        if (modal.getAttribute('aria-hidden') === 'true') return;
        if (modal.classList.contains('MuiModal-hidden')) return;
        if (modal.querySelector('.MuiDrawer-paperAnchorBottom')) open = true;
      });
      setHasBottomDrawerOpen(open);
    };

    evaluateDrawerState();

    const observer = new MutationObserver(() => {
      evaluateDrawerState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'style'],
    });

    return () => observer.disconnect();
  }, []);

  const isNoteFullPageDetail = Boolean(pathname?.match(/^\/note\/notes\/[^/]+$/));
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));

  // Accounts: never use unified bottom chrome — `/accounts/settings/*` renders its own bottom nav in layout;
  // billing/success/checkout/login and other interim flows should stay full-bleed with no duplicate empty bar.
  if (pathname?.startsWith('/accounts')) return null;

  // Hide bottom bar on settings page, when a real bottom sheet is open, or on full-page note editor
  if (pathname === '/settings' || hasBottomDrawerOpen || isNoteFullPageDetail || isConnectCallDetail) return null;

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
