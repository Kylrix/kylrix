'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
} from '@mui/material';
import {
  GridView as OverviewIcon,
  VpnKey as CredentialsIcon,
  FileDownload as ImportIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export default function BottomNav() {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Determine active value based on pathname
  const getValue = () => {
    if (pathname.startsWith('/overview')) return 'overview';
    if (pathname.startsWith('/credentials')) return 'credentials';
    if (pathname.startsWith('/import')) return 'import';
    if (pathname.startsWith('/settings')) return 'settings';
    // Default to overview for /dashboard
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) return 'overview';
    return 'overview';
  };

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    const routes: Record<string, string> = {
      overview: '/dashboard',
      credentials: '/credentials',
      import: '/import',
      settings: '/settings',
    };
    router.push(routes[newValue] || '/dashboard');
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
        zIndex: theme.zIndex.appBar + 1,
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
          value={getValue()}
          onChange={handleChange}
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
                color: '#10B981',
                '& svg': {
                  transform: 'scale(1.2) translateY(-2px)',
                  filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))',
                }
              },
            },
          }}
        >
          <BottomNavigationAction
            value="overview"
            icon={<OverviewIcon sx={{ fontSize: 28 }} />}
          />
          <BottomNavigationAction
            value="credentials"
            icon={<CredentialsIcon sx={{ fontSize: 28 }} />}
          />
          <BottomNavigationAction
            value="import"
            icon={<ImportIcon sx={{ fontSize: 28 }} />}
          />
          <BottomNavigationAction
            value="settings"
            icon={<SettingsIcon sx={{ fontSize: 28 }} />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
