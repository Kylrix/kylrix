'use client';

import { ReactNode } from 'react';
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

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppwriteProvider>
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
                                <PotatoProvider>
                                  {children}
                                </PotatoProvider>
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
      </AppwriteProvider>
    </AuthProvider>
  );
}
