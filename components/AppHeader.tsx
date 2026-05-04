'use client';

import NoteTopbar from '@/components/common/NoteTopbar';

interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className }: AppHeaderProps) {
  return <NoteTopbar className={className} mode="app" />;
}
