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

const ClientToaster = dynamic(() => import('@/components/ClientToaster'), { ssr: false });

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
    <AuthProvider>
      <AppwriteProvider>
        <ThemeProvider>
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
    <ClientToaster />
    </>
  );
}
