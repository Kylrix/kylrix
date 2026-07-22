'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AppwriteProvider } from '@/app/(app)/vault/appwrite-provider';
import { ThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/components/ui/Toast';
import { UnifiedDrawerProvider } from '@/context/UnifiedDrawerContext';
import { ProUpgradeProvider } from '@/context/ProUpgradeContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { ResourcePinProvider } from '@/context/ResourcePinContext';
import { TaskProvider } from '@/context/TaskContext';
import { OverlayProvider } from '@/components/ui/OverlayContext';
import { DynamicSidebarProvider } from '@/components/ui/DynamicSidebar';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import { SectionProvider } from '@/context/SectionContext';
import { WalletOverlayProvider } from '@/context/WalletOverlayContext';
import { AgenticDrawerProvider } from '@/context/AgenticDrawerContext';
import { TokenOpsProvider } from '@/context/TokenOpsContext';
import { PresenceProvider } from '@/components/providers/PresenceProvider';
import { AIProvider } from '@/context/AIContext';
import { AppChromeProvider } from '@/components/providers/AppChromeProvider';
import { SudoProvider } from '@/context/SudoContext';
import { DrawerStateProvider } from '@/components/ui/DrawerStateContext';
import { CallLauncherProvider } from '@/context/CallLauncherContext';
import { LocalContextProvider } from '@/lib/context-engine';
import { SetupProvider } from '@/context/SetupContext';

import { SpineProvider } from '@/context/SpineContext';
import { NeuralProvider } from '@/context/NeuralContext';

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

import { SecurityProvider } from '@/context/SecurityContext';

/**
 * Tier 1: Root Providers
 * Mandatory for GlobalShell and UI orchestration. 
 * Lightweight UI-state providers that don't block hydration with heavy data fetching.
 */
const rootProvidersList: Array<React.ComponentType<{ children: ReactNode }>> = [
  SpineProvider,
  NeuralProvider,
  SecurityProvider,
  DrawerStateProvider,
  AppwriteProvider,
  SudoProvider,
  LocalContextProvider,
  AppChromeProvider,
  CallLauncherProvider,
  ThemeProvider,
  ToastProvider,
  UnifiedDrawerProvider,
  ProUpgradeProvider,
  SubscriptionProvider,
  ResourcePinProvider,
  TaskProvider,
  OverlayProvider,
  DynamicSidebarProvider,
  SidebarProvider,
  SectionProvider,
  WalletOverlayProvider,
  AgenticDrawerProvider,
  PresenceProvider,
  TokenOpsProvider,
  AIProvider,
  SetupProvider,
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
