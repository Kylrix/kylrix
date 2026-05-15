import React from 'react';
import { Suspense } from 'react';
import { LayoutProvider } from '@/context/LayoutContext';
export default function FlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutProvider>{children}</LayoutProvider>;
}
