import React from 'react';
import { LayoutProvider } from '@/context/LayoutContext';
import MainLayout from '@/components/layout/MainLayout';

export default function FlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutProvider>
      <MainLayout>{children}</MainLayout>
    </LayoutProvider>
  );
}
