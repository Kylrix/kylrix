'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/context/auth/AuthContext';
import { AppwriteProvider } from '@/app/(app)/vault/appwrite-provider';
import { DocsProvider } from '@/context/DocsContext';
import { SubscriptionProvider } from '@/context/subscription/SubscriptionContext';
import { NotesProvider } from '@/context/NotesContext';
import { TaskProvider } from '@/context/TaskContext';
import { BackgroundTaskProvider } from '@/context/BackgroundTaskContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SourceProvider } from '@/lib/source-context';
import { PotatoProvider } from '@/components/providers/PotatoProvider';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import { DynamicSidebarProvider } from '@/components/ui/DynamicSidebar';
import { DrawerStateProvider } from '@/components/ui/DrawerStateContext';
import { SudoProvider } from '@/context/SudoContext';
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

function NavigationReloadGuard() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAssign = window.location.assign.bind(window.location);
    const originalReplace = window.location.replace.bind(window.location);

    const toInternalPath = (input: string): string | null => {
      const href = String(input || '').trim();
      if (!href) return null;
      try {
        if (href.startsWith('/')) return href;
        const parsed = new URL(href, window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return null;
      }
    };

    try {
      (window.location as any).assign = (value: string | URL) => {
        const target = toInternalPath(String(value));
        if (target) {
          router.push(target);
          return;
        }
        originalAssign(String(value));
      };

      (window.location as any).replace = (value: string | URL) => {
        const target = toInternalPath(String(value));
        if (target) {
          router.replace(target);
          return;
        }
        originalReplace(String(value));
      };
    } catch {
      // Some environments lock location methods; direct callsite migration still applies.
    }

    return () => {
      (window.location as any).assign = originalAssign;
      (window.location as any).replace = originalReplace;
    };
  }, [router]);

  return null;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppwriteProvider>
        <ThemeProvider>
        <NavigationReloadGuard />
        <DocsProvider>
          <SubscriptionProvider>
            <NotesProvider>
              <TaskProvider>
                <BackgroundTaskProvider>
                  <NotificationProvider>
                    <SourceProvider>
                      <SudoProvider>
                        <SidebarProvider>
                          <DynamicSidebarProvider>
                            <DrawerStateProvider>
                              <ProUpgradeProvider>
                                <AgenticDrawerProvider>
                                  <AIProvider>
                                    <OverlayProvider>
                                      <ContextMenuProvider>
                                        <GlobalContextMenu />
                                        <ToastProvider>
                                          <PotatoProvider>
                                            <AppChromeProvider>
                                              <TokenOpsProvider>
                                                <WalletOverlayProvider>
                                                  <ChatNotificationProvider>
                                                    <CallLauncherProvider>
                                                      {children}
                                                    </CallLauncherProvider>
                                                  </ChatNotificationProvider>
                                                </WalletOverlayProvider>
                                              </TokenOpsProvider>
                                            </AppChromeProvider>
                                          </PotatoProvider>
                                        </ToastProvider>
                                      </ContextMenuProvider>
                                    </OverlayProvider>
                                  </AIProvider>
                                </AgenticDrawerProvider>
                              </ProUpgradeProvider>
                            </DrawerStateProvider>
                          </DynamicSidebarProvider>
                        </SidebarProvider>
                      </SudoProvider>
                    </SourceProvider>
                  </NotificationProvider>
                </BackgroundTaskProvider>
              </TaskProvider>
            </NotesProvider>
          </SubscriptionProvider>
        </DocsProvider>
        </ThemeProvider>
      </AppwriteProvider>
    </AuthProvider>
  );
}
