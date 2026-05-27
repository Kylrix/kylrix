'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/context/auth/AuthContext';
import { AppwriteProvider } from '@/app/(app)/vault/appwrite-provider';
import { DocsProvider } from '@/context/DocsContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { NotesProvider } from '@/context/NotesContext';
import { TaskProvider } from '@/context/TaskContext';
import { BackgroundTaskProvider } from '@/context/BackgroundTaskContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SourceProvider } from '@/lib/source-context';
import { LocalContextProvider } from '@/lib/context-engine';
import { PotatoProvider } from '@/components/providers/PotatoProvider';
import { ProfileProvider } from '@/components/providers/ProfileProvider';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import { DynamicSidebarProvider } from '@/components/ui/DynamicSidebar';
import { DrawerStateProvider } from '@/components/ui/DrawerStateContext';
import { SudoProvider } from '@/context/SudoContext';
import { UnifiedDrawerProvider } from '@/context/UnifiedDrawerContext';
import { NoteDrawerProvider } from '../context/NoteDrawerContext';
import { ProUpgradeProvider } from '@/context/ProUpgradeContext';
import { AgenticDrawerProvider } from '@/context/AgenticDrawerContext';
import { AIProvider } from '@/context/AIContext';
import { OverlayProvider } from '@/components/ui/OverlayContext';
import { ContextMenuProvider } from '@/components/ui/ContextMenuContext';
import { GlobalContextMenu } from '@/components/ui/GlobalContextMenu';
import { ToastProvider } from '@/components/ui/Toast';
import { AppChromeProvider } from '@/components/providers/AppChromeProvider';
import { ChatNotificationProvider } from '@/components/providers/ChatNotificationProvider';
import { ThemeProvider } from '@/lib/theme-context';
import { CallLauncherProvider } from '@/context/CallLauncherContext';
import { WalletOverlayProvider } from '@/context/WalletOverlayContext';
import { TokenOpsProvider } from '@/context/TokenOpsContext';
import GlobalShortcuts from '@/components/GlobalShortcuts';

const ClientToaster = dynamic(() => import('@/components/ClientToaster'), { ssr: false });
const PresenceProvider = dynamic(() => import('@/components/providers/PresenceProvider').then(m => m.PresenceProvider), { ssr: false });

// Helper wrappers for nested elements inside the provider tree
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

/**
 * Dynamic composition helper to flatten deeply-nested React Contexts
 */
function ComposeProviders({ providers, children }: ComposeProvidersProps) {
  return (
    <>
      {providers.reduceRight((acc, Provider) => {
        return <Provider>{acc}</Provider>;
      }, children)}
    </>
  );
}

const providersList: Array<React.ComponentType<{ children: ReactNode }>> = [
  AuthProvider,
  AppwriteProvider,
  ThemeProvider,
  DocsProvider,
  SubscriptionProvider,
  NotesProvider,
  ProfileProvider,
  TaskProvider,
  BackgroundTaskProvider,
  NotificationProvider,
  SourceProvider,
  LocalContextProvider,
  DrawerStateProvider,
  SudoProvider,
  UnifiedDrawerProvider,
  NoteDrawerProvider,
  SidebarProvider,
  DynamicSidebarProvider,
  ProUpgradeProvider,
  AgenticDrawerProvider,
  AIProvider,
  OverlayProvider,
  ToastProvider,
  ContextMenuWrapper,
  PotatoProvider,
  AppChromeProvider,
  TokenOpsProvider,
  WalletOverlayProvider,
  ChatNotificationProvider,
  CallLauncherProvider,
  PresenceWrapper,
];

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <ComposeProviders providers={providersList}>
        {children}
      </ComposeProviders>
      <ClientToaster />
    </>
  );
}
