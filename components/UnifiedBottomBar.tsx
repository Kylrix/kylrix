'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
} from '@mui/material';
import {
  FileText as NotesIcon,
  VpnKey as VaultIcon,
  CheckSquare as FlowIcon,
  MessageCircle as ConnectIcon,
  User as AccountsIcon,
} from 'lucide-react';

/**
 * Persistent unified bottom bar across all apps.
 * Only renders on mobile, mounts once and persists across routes.
 */
export function UnifiedBottomBar() {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Determine which app we're in and active nav item
  const appContext = useMemo(() => {
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    return 'note'; // Default
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

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'note') router.push('/note');
    if (newValue === 'vault') router.push('/vault');
    if (newValue === 'flow') router.push('/flow');
    if (newValue === 'connect') router.push('/connect');
    if (newValue === 'accounts') router.push('/accounts');
  };

  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 48px)',
        maxWidth: '400px',
        zIndex: theme.zIndex.appBar,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          overflow: 'hidden',
          backgroundColor: 'rgba(11, 9, 8, 0.8)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <BottomNavigation
          value={appContext}
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
          <BottomNavigationAction
            value="note"
            icon={<NotesIcon size={24} strokeWidth={1.5} className="lucide" />}
          />
          <BottomNavigationAction
            value="vault"
            icon={<VaultIcon size={24} strokeWidth={1.5} className="lucide" />}
          />
          <BottomNavigationAction
            value="flow"
            icon={<FlowIcon size={24} strokeWidth={1.5} className="lucide" />}
          />
          <BottomNavigationAction
            value="connect"
            icon={<ConnectIcon size={24} strokeWidth={1.5} className="lucide" />}
          />
          <BottomNavigationAction
            value="accounts"
            icon={<AccountsIcon size={24} strokeWidth={1.5} className="lucide" />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
