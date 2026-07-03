'use client';

import React, { useEffect, Suspense, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { hasAuthSessionHint } from '@/lib/appwrite/client';
import { EcosystemProviders } from './EcosystemProviders';
import { AppDynamicSidebarPortal } from '@/components/ui/AppDynamicSidebarPortal';
import { GhostNoteClaimer } from '@/components/landing/GhostNoteClaimer';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayoutContent>{children}</AppLayoutContent>;
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const authGraceUntilRef = useRef(0);

  useEffect(() => {
    if (isAuthenticated) {
      authGraceUntilRef.current = Date.now() + 15_000;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Zero-Idle Mandate: Redirect unauthenticated users to /send
    if (isLoading) return;

    if (!isAuthenticated) {
      if (hasAuthSessionHint() || Date.now() < authGraceUntilRef.current) {
        return;
      }

      const path = pathname || '';
      const isPublic = 
        path === '/' ||
        path.startsWith('/send') ||
        path.startsWith('/app/shared') ||
        path.startsWith('/idea') ||
        path.startsWith('/i/') ||
        path.startsWith('/u/') ||
        path.startsWith('/p/') ||
        path.startsWith('/call/') ||
        path.startsWith('/connect/call/') ||
        path.startsWith('/flow/form/') ||
        path.startsWith('/flow/goal/') ||
        path.startsWith('/flow/forms/') ||
        path.startsWith('/flow/events/');

      if (isPublic) return;

      const protectedDashboardPrefixes = [
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

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#0A0908]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
      <EcosystemProviders>
        <GhostNoteClaimer />
        {children}
        <AppDynamicSidebarPortal />
      </EcosystemProviders>
    </Suspense>
  );
}
