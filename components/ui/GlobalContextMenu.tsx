'use client';

import React, { lazy, Suspense } from 'react';
import { useContextMenu } from './ContextMenuContext';

// Lazy load context menu only when needed
const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })));

export const GlobalContextMenu: React.FC = () => {
  const { isOpen, state, closeMenu } = useContextMenu();
  if (!isOpen || !state) return null;
  return (
    <Suspense fallback={null}>
      <ContextMenu x={state.x} y={state.y} items={state.items} onCloseAction={closeMenu} />
    </Suspense>
  );
};
