'use client';

import { ReactNode } from 'react';
import { AppwriteProvider } from '@/app/(app)/vault/appwrite-provider';
import { DocsProvider } from '@/context/DocsContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { NotesProvider } from '@/context/NotesContext';
import { BackgroundTaskProvider } from '@/context/BackgroundTaskContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SourceProvider } from '@/lib/source-context';
import { LocalContextProvider } from '@/lib/context-engine';
import { PotatoProvider } from '@/components/providers/PotatoProvider';
import { ProfileProvider } from '@/components/providers/ProfileProvider';
import { DrawerStateProvider } from '@/components/ui/DrawerStateContext';
import { SudoProvider } from '@/context/SudoContext';
import { UnifiedDrawerProvider } from '@/context/UnifiedDrawerContext';
import { NoteDrawerProvider } from '@/context/NoteDrawerContext';
import { ContextMenuProvider } from '@/components/ui/ContextMenuContext';
import { GlobalContextMenu } from '@/components/ui/GlobalContextMenu';
import { ChatNotificationProvider } from '@/components/providers/ChatNotificationProvider';
import { CallLauncherProvider } from '@/context/CallLauncherContext';
import { TokenOpsProvider } from '@/context/TokenOpsContext';
import GlobalShortcuts from '@/components/GlobalShortcuts';
import dynamic from 'next/dynamic';

const PresenceProvider = dynamic(() => import('@/components/providers/PresenceProvider').then(m => m.PresenceProvider), { ssr: false });

function ContextMenuWrapper({ children }: { children: ReactNode }) {
  return (
    <ContextMenuProvider>
      <GlobalContextMenu />
      {children}
    </ContextMenuProvider>
  );
}

function PresenceWrapper({ children }: { children: ReactNode }) {
  return (
    <PresenceProvider>
      <GlobalShortcuts />
      {children}
    </PresenceProvider>
  );
}

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
 * Tier 2: Ecosystem Providers
 * Contains heavy logic, data-fetching contexts, and realtime subscriptions.
 * Mounted only within the protected (app) layout.
 */
const ecosystemProvidersList: Array<React.ComponentType<{ children: ReactNode }>> = [
  AppwriteProvider,
  DocsProvider,
  SubscriptionProvider,
  NotesProvider,
  ProfileProvider,
  BackgroundTaskProvider,
  NotificationProvider,
  SourceProvider,
  LocalContextProvider,
  DrawerStateProvider,
  SudoProvider,
  NoteDrawerProvider,
  ContextMenuWrapper,
  PotatoProvider,
  TokenOpsProvider,
  ChatNotificationProvider,
  CallLauncherProvider,
  PresenceWrapper,
];

export function EcosystemProviders({ children }: { children: ReactNode }) {
  return (
    <ComposeProviders providers={ecosystemProvidersList}>
      {children}
    </ComposeProviders>
  );
}
