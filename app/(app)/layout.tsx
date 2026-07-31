'use client';

import React, { useEffect, Suspense, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { hasAuthSessionHint } from '@/lib/appwrite/client';
import { EcosystemProviders } from './EcosystemProviders';
import { GhostNoteClaimer } from '@/components/landing/GhostNoteClaimer';

export default function AppLayout({
  children}: {
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
        path.startsWith('/') ||
        path.startsWith('/billing/coupon') ||
        path.startsWith('/') ||
        path.startsWith('/') ||
        path.startsWith('/r/') ||
        path.startsWith('/app') ||
        path.startsWith('/idea') ||
        path.startsWith('/i/') ||
        path.startsWith('/u/') ||
        path.startsWith('/p/') ||
        path.startsWith('/call/') ||
        path.startsWith('/connect/call/') ||
        path.startsWith('/form/') ||
        path.startsWith('/goal/') ||
        path.startsWith('/goal/') ||
        path.startsWith('/forms/') ||
        path.startsWith('/events/') ||
        path.startsWith('/agents/session/') ||
        path.startsWith('/agents/chat/');

      if (isPublic) return;

      const protectedDashboardPrefixes = [
        '/workspaces',
        '/billing',
        '/settings',
        '/settings/agents'
      ];

      const isDashboard = protectedDashboardPrefixes.some((prefix) => {
        if (prefix === '/settings/agents') {
          return path === '/settings/agents' || path.startsWith('/agents/');
        }
        return path.startsWith(prefix);
      });

      // Public agent share routes already returned above; remaining /agents* stay gated.

      if (isDashboard) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('kylrix_send_redirect_source', path);
        }
        router.replace('/app?login=1');
      }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#0A0908]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
      <EcosystemProviders>
        <GhostNoteClaimer />
        {children}
        {/* Agentic + dynamic sidebars mount via NativeSidebarBridge */}
      </EcosystemProviders>
    </Suspense>
  );
}
