'use client';

import { ReactNode } from 'react';
import { DocsProvider } from '@/context/DocsContext';
import { BackgroundTaskProvider } from '@/context/BackgroundTaskContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SourceProvider } from '@/lib/source-context';
import { ProfileProvider } from '@/components/providers/ProfileProvider';
import { NoteDrawerProvider } from '@/context/NoteDrawerContext';
import { LoginDrawerProvider } from '@/context/LoginDrawerContext';
import { ChatNotificationProvider } from '@/components/providers/ChatNotificationProvider';
import { TokenOpsProvider } from '@/context/TokenOpsContext';
import { EcosystemStateTracker } from '@/components/providers/EcosystemStateTracker';

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
  DocsProvider,
  ProfileProvider,
  BackgroundTaskProvider,
  NotificationProvider,
  SourceProvider,
  NoteDrawerProvider,
  LoginDrawerProvider,
  TokenOpsProvider,
  ChatNotificationProvider,
  EcosystemStateTracker,
];
export function EcosystemProviders({ children }: { children: ReactNode }) {
  return (
    <ComposeProviders providers={ecosystemProvidersList}>
      {children}
    </ComposeProviders>
  );
}
