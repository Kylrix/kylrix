import React from 'react';
import AppLayoutContent from './AppLayoutContent';

/** Sidebar + dynamic sidebar state come from root ClientProviders / GlobalShell — do not nest duplicate providers here. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayoutContent>{children}</AppLayoutContent>;
}
