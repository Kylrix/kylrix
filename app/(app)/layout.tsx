'use client';

import React, { useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { EcosystemProviders } from './EcosystemProviders';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';
import { SidekickHistoryBridge } from '@/components/agentic/SidekickHistoryBridge';

export default function AppLayout({
  children}: {
  children: React.ReactNode;
}) {
  return <AppLayoutContent>{children}</AppLayoutContent>;
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const authGraceUntilRef = useRef(0);

  useEffect(() => {
    if (isAuthenticated) {
      authGraceUntilRef.current = Date.now() + 15_000;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Offline-first Mandate: Offline and unauthenticated users can access all application surfaces,
    // including settings, notes, ideas, goals, events, forms, vault, secrets, and TOTPs.
    // Local state is stored in RxDB / LocalEngine and synced when online / authenticated.
    if (isLoading) return;
  }, [isLoading]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[#0A0908]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
      <EcosystemProviders>
        <ThreadNoteClaimer />
        {children}
        <SidekickHistoryBridge />
        {/* Agentic/wallet/unified → NativeSidebarBridge; object details → Overlay/DynamicSidebar */}
      </EcosystemProviders>
    </Suspense>
  );
}
