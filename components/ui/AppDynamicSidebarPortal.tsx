'use client';

import dynamic from 'next/dynamic';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';

const DynamicSidebar = dynamic(
  () => import('@/components/ui/DynamicSidebarPanel').then((m) => m.DynamicSidebar),
  { ssr: false },
);

/** Mounted inside EcosystemProviders so panels (e.g. pinned notes) see NotesContext. */
export function AppDynamicSidebarPortal() {
  const { isOpen } = useDynamicSidebar();
  if (!isOpen) return null;
  return <DynamicSidebar />;
}
