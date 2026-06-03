'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';

import { AuthProvider } from '@/context/auth/AuthContext';
import { EcosystemProviders } from './EcosystemProviders';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </AuthProvider>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Zero-Idle Mandate: Redirect unauthenticated users to /send
    if (!isLoading && !isAuthenticated) {
      // ... (keep the same redirect logic) ...
      const path = pathname || '';
      const isPublic = 
        path === '/' ||
        path.startsWith('/send') ||
        path.startsWith('/note/shared') ||
        path.startsWith('/i/') ||
        path.startsWith('/u/') ||
        path.startsWith('/p/') ||
        path.startsWith('/call/') ||
        path.startsWith('/connect/call/') ||
        path.startsWith('/flow/forms/') ||
        path.startsWith('/flow/events/');

      if (isPublic) return;

      const protectedDashboardPrefixes = [
        '/note',
        '/vault',
        '/flow',
        '/connect',
        '/projects',
        '/accounts',
        '/settings',
        '/agents'
      ];

      const isDashboard = protectedDashboardPrefixes.some(prefix => path.startsWith(prefix));

      if (isDashboard) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('kylrix_send_redirect_source', path);
        }
        router.replace('/send?login=1');
      }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  return <EcosystemProviders>{children}</EcosystemProviders>;
}
