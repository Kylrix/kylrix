'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useContextMenu } from './ContextMenuContext';

// Lazy load context menu only when needed (mobile bottom drawer)
const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })));

export const GlobalContextMenu: React.FC = () => {
  const context = useContextMenu();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isDesktop || !context || !context.isOpen || !context.state) return null;
  const { state, closeMenu } = context;
  return (
    <Suspense fallback={null}>
      <ContextMenu x={state.x} y={state.y} items={state.items} onCloseAction={closeMenu} appType={state.appType} />
    </Suspense>
  );
};
