import React from 'react';
import { SidebarProvider } from '@/components/ui/SidebarContext';
import { DynamicSidebarProvider } from '@/components/ui/DynamicSidebar';
import AppLayoutContent from './AppLayoutContent';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DynamicSidebarProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </DynamicSidebarProvider>
    </SidebarProvider>
  );
}
