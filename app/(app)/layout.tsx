'use client';

import type { Metadata } from 'next';
import { Box } from '@mui/material';
import { UnifiedTopbar } from '@/components/UnifiedTopbar';

/**
 * Unified layout for all app subroutes: /note, /vault, /flow, /connect, /accounts
 * Contains the PERSISTENT topbar that transforms based on route (never unmounts).
 * Auth, theme, and other global providers are already in root layout.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Persistent topbar - mounts once, never unmounts */}
      <UnifiedTopbar />
      
      {/* App content */}
      <Box component="main" sx={{ pt: '88px' }}>
        {children}
      </Box>
    </Box>
  );
}
