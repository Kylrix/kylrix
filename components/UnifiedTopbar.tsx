'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Box, IconButton } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import NoteTopbar from '@/components/common/NoteTopbar';
import VaultTopbar from '@/components/common/VaultTopbar';
import ConnectTopbar from '@/components/layout/ConnectTopbar';
import TopbarShell from '@/components/layout/TopbarShell';
import { useAuth } from '@/context/auth/AuthContext';

/**
 * Persistent unified topbar that transforms based on current route.
 * Never unmounts when navigating between app sections.
 * On /settings, shows ecosystem branding with back button.
 */
export function UnifiedTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Check if we're on settings page FIRST
  const isSettingsPage = useMemo(() => pathname === '/settings', [pathname]);

  // Determine which app we're in based on pathname (ignoring /settings)
  const appContext = useMemo(() => {
    if (isSettingsPage) return null;
    if (pathname?.startsWith('/note')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    if (pathname?.startsWith('/accounts')) return 'accounts';
    return null;
  }, [pathname, isSettingsPage]);

  // On settings page, show ecosystem logo with back button
  if (isSettingsPage) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 88,
          bgcolor: '#0A0908',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          zIndex: 1200,
        }}
      >
        <IconButton
          onClick={() => router.back()}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            p: 1.5,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
            }
          }}
        >
          <ArrowLeft size={20} color="white" />
        </IconButton>

        <Box sx={{ fontSize: '20px', fontWeight: 900, color: 'white', fontFamily: 'var(--font-clash)' }}>
          Kylrix
        </Box>

        <Box sx={{ width: 56 }} />
      </Box>
    );
  }

  // Render appropriate topbar based on context
  // Each topbar only changes its rendered content, never unmounts
  if (appContext === 'note') {
    return <NoteTopbar />;
  }
  if (appContext === 'vault') {
    return <VaultTopbar />;
  }
  if (appContext === 'connect') {
    return <ConnectTopbar />;
  }
  if (appContext === 'accounts') {
    return <TopbarShell />;
  }
  if (appContext === 'flow') {
    // Flow also uses TopbarShell-style topbar
    return <TopbarShell />;
  }

  return null;
}
