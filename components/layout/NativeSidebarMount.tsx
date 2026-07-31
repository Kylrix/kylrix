'use client';

import { useEffect, type ReactNode } from 'react';
import { useNativeSidebarOptional } from '@/context/RightRailContext';

type Props = {
  active: boolean;
  sidebarKey: string;
  width?: number;
  title?: string;
  sticky?: boolean;
  children: ReactNode;
};

/**
 * Mounts children into the unified native right sidebar while `active`.
 * Instant swap when content changes; unloads on deactivate.
 */
export function NativeSidebarMount({
  active,
  sidebarKey,
  width = 420,
  title,
  sticky,
  children,
}: Props) {
  const native = useNativeSidebarOptional();

  useEffect(() => {
    if (!native) return;
    if (!active) {
      if (native.activeKey === sidebarKey) native.close(sidebarKey);
      return;
    }
    const opts = { key: sidebarKey, width, title, sticky };
    if (native.activeKey === sidebarKey) {
      native.swap(children, opts);
    } else {
      native.open(children, opts);
    }
  }, [active, children, native, sidebarKey, width, title, sticky]);

  return null;
}
