'use client';

import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@/lib/mui-tailwind/material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';

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
    // Background re-authentication if needed
    if (!isLoading && !isAuthenticated && !publicRoute) {
      openIDMWindow();
    }

    // Silent redirect if on root
    if (!isLoading && isAuthenticated && pathname === '/') {
      router.replace('/note');
    }
  }, [isLoading, isAuthenticated, pathname, router, openIDMWindow, publicRoute]);

  // MANDATE: The skeleton is the page itself.
  // Never block the children from rendering. 
  // Individual components will handle their own "Loading..." state based on useAuth().isLoading
  return <>{children}</>;
};
