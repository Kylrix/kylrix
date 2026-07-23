'use client';

import React, { lazy, Suspense } from 'react';
import { useContextMenu } from './ContextMenuContext';

// Lazy load context menu only when needed
const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })));

export const GlobalContextMenu: React.FC = () => {
  const context = useContextMenu();
  if (!context || !context.isOpen || !context.state) return null;
  const { state, closeMenu } = context;
  return (
    <Suspense fallback={null}>
      <ContextMenu x={state.x} y={state.y} items={state.items} onCloseAction={closeMenu} appType={state.appType} />
    </Suspense>
  );
};
