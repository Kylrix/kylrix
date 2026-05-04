'use client';

import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = [
  '/',
  '/landing',
  '/signup',
  '/reset',
  '/verify'
];

const SHARED_NOTE_PATTERN = /^\/shared\/.+$/;

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.includes(path) || SHARED_NOTE_PATTERN.test(path);
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { isLoading, isAuthenticated, openIDMWindow } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publicRoute = isPublicRoute(pathname);

  useEffect(() => {
    if (isLoading && publicRoute) {
      return;
    }

    if (isLoading) {
      return;
    }

    // If user is not authenticated and trying to access protected route
    if (!isAuthenticated && !publicRoute) {
      openIDMWindow();
      return;
    }

    // If user is authenticated and on landing page, redirect to notes
    if (isAuthenticated && pathname === '/') {
      // Use silent redirect without global loading
      router.replace('/note');
      return;
    }

  }, [isLoading, isAuthenticated, pathname, router, openIDMWindow, publicRoute]);

  // Show loading during initial auth check
  if (isLoading && !publicRoute) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top, rgba(15,14,18,0.95), rgba(4,3,7,0.98))',
          color: '#fff',
        }}
      >
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  // For protected routes when user is not authenticated, stay on current page and show IDM window
  if (!isAuthenticated && !publicRoute) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'rgba(5, 5, 5, 0.85)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            maxWidth: 420,
            px: 3,
          }}
        >
          <Typography variant="h5" sx={{ color: '#ffffff', mb: 1 }}>
            Authentication in progress
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Your IDM window is active. Once you finish signing in, this view will return automatically.
          </Typography>
          <CircularProgress sx={{ color: '#6366F1', mt: 4 }} size={32} thickness={4} />
        </Box>
      </Box>
    );
  }

  if (isAuthenticated && pathname === '/') {
    return null; // Will redirect to notes
  }

  return <>{children}</>;
};
