import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function SilentCheckLayout({ children }: { children: ReactNode }) {
  return children;
}
