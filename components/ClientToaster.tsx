'use client';

import { Toaster } from 'react-hot-toast';

/**
 * Isolated so the root provider tree can code-split `react-hot-toast` from the initial bundle.
 */
export default function ClientToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ zIndex: 2147483000 }}
      toastOptions={{
        style: {
          background: '#161412',
          color: '#f2f2f2',
          border: '1px solid rgba(255,255,255,0.08)',
          zIndex: 2147483000,
        }}}
    />
  );
}
