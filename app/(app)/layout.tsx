'use client';

import type { Metadata } from 'next';
import { Box } from '@mui/material';
import { Suspense } from 'react';
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
      {/* Persistent fixed topbar - mounts once, never unmounts */}
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <Suspense fallback={null}>
          <UnifiedTopbar />
        </Suspense>
      </Box>
      
      {/* App content - no top padding needed, topbar is fixed */}
      <Box component="main" sx={{ width: '100%' }}>
        {children}
      </Box>
    </Box>
  );
}
