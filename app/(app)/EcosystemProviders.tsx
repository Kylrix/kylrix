'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/auth/AuthContext';
import { SudoProvider } from '@/context/SudoContext';
import { AppwriteProvider } from '@/app/(app)/vault/appwrite-provider';
import { DocsProvider } from '@/context/DocsContext';
import { NotesProvider } from '@/context/NotesContext';
import { BackgroundTaskProvider } from '@/context/BackgroundTaskContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SourceProvider } from '@/lib/source-context';
import { PotatoProvider } from '@/components/providers/PotatoProvider';
import { ProfileProvider } from '@/components/providers/ProfileProvider';
import { UnifiedDrawerProvider } from '@/context/UnifiedDrawerContext';
import { NoteDrawerProvider } from '@/context/NoteDrawerContext';
import { LoginDrawerProvider } from '@/context/LoginDrawerContext';
import { ContextMenuProvider } from '@/components/ui/ContextMenuContext';
import { GlobalContextMenu } from '@/components/ui/GlobalContextMenu';
import { ChatNotificationProvider } from '@/components/providers/ChatNotificationProvider';
import { TokenOpsProvider } from '@/context/TokenOpsContext';
import GlobalShortcuts from '@/components/GlobalShortcuts';
import dynamic from 'next/dynamic';
import { SectionProvider } from '@/context/SectionContext';
import { EcosystemStateTracker } from '@/components/providers/EcosystemStateTracker';

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
  AuthProvider,
  AppwriteProvider,
  SudoProvider,
  DocsProvider,
  NotesProvider,
  ProfileProvider,
  BackgroundTaskProvider,
  NotificationProvider,
  SourceProvider,
  NoteDrawerProvider,
  LoginDrawerProvider,
  ContextMenuWrapper,
  PotatoProvider,
  TokenOpsProvider,
  ChatNotificationProvider,
  PresenceWrapper,
  EcosystemStateTracker,
  ];
export function EcosystemProviders({ children }: { children: ReactNode }) {
  return (
    <ComposeProviders providers={ecosystemProvidersList}>
      {children}
    </ComposeProviders>
  );
}
