'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/context/auth/AuthContext';
import { ThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/components/ui/Toast';
import { UnifiedDrawerProvider } from '@/context/UnifiedDrawerContext';
import { TaskProvider } from '@/context/TaskContext';
import { OverlayProvider } from '@/components/ui/OverlayContext';
import { DynamicSidebarProvider } from '@/components/ui/DynamicSidebarContext';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import { WalletOverlayProvider } from '@/context/WalletOverlayContext';

const ClientToaster = dynamic(() => import('@/components/ClientToaster'), { ssr: false });

interface ComposeProvidersProps {
  providers: Array<React.ComponentType<{ children: ReactNode }>>;
  children: ReactNode;
}

function ComposeProviders({ providers, children }: ComposeProvidersProps) {
  return (
    <>
      {providers.reduceRight((acc, Provider) => {
        return <Provider>{acc}</Provider>;
      }, children)}
    </>
  );
}

/**
 * Root-level ClientProviders.
 * Keeps public pages (/send, /) ultra-lightweight. Heavy ecosystem providers live in app/(app)/EcosystemProviders.tsx.
 */
const rootProvidersList: Array<React.ComponentType<{ children: ReactNode }>> = [
  AuthProvider,
  ThemeProvider,
  UnifiedDrawerProvider,
  TaskProvider,
  OverlayProvider,
  DynamicSidebarProvider,
  SidebarProvider,
  WalletOverlayProvider,
  ToastProvider,
];

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <ComposeProviders providers={rootProvidersList}>
        {children}
      </ComposeProviders>
      <ClientToaster />
    </>
  );
}
