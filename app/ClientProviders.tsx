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
              <ProfileProvider>
              <TaskProvider>
                <BackgroundTaskProvider>
                  <NotificationProvider>
                    <SourceProvider>
                      <LocalContextProvider>
                        <DrawerStateProvider>
                        <SudoProvider>
                          <UnifiedDrawerProvider>
                            <NoteDrawerProvider>
                              <SidebarProvider>
                                <DynamicSidebarProvider>
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
                                </DynamicSidebarProvider>
                              </SidebarProvider>
                            </NoteDrawerProvider>
                          </UnifiedDrawerProvider>
                        </SudoProvider>
                      </DrawerStateProvider>
                    </LocalContextProvider>
                  </SourceProvider>
                  </NotificationProvider>
                </BackgroundTaskProvider>
              </TaskProvider>
              </ProfileProvider>
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
