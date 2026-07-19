'use client';

import { useEffect } from 'react';

interface RuntimeErrorDrawerProps {
  error: Error & { digest?: string };
  reset: () => void;
  heading?: string;
  description?: string;
}

export default function RuntimeErrorDrawer({
  error,
  reset,
  heading = 'Something went wrong',
  description = 'We hit an unexpected problem. Use one of the options below to recover.',
}: RuntimeErrorDrawerProps) {
  useEffect(() => {
    console.error('Application crash:', error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-[99999] bg-black text-neutral-200 min-h-screen relative antialiased font-sans overflow-hidden select-none">
      <div className="absolute inset-0 bg-neutral-950 z-40" />

      <div className="absolute bottom-0 left-0 right-0 max-w-xl mx-auto p-4 z-50 animate-in slide-in-from-bottom duration-300 ease-out">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-mono text-xs uppercase tracking-wider font-semibold">App Error</h2>
            </div>
            {error.digest ? (
              <span className="font-mono text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800/60">
                id: {error.digest}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-neutral-300">{heading}</p>
            <p className="text-xs text-neutral-400">{description}</p>
            <div className="max-h-28 overflow-y-auto bg-neutral-950 p-2.5 rounded border border-neutral-800/40">
              <p className="font-mono text-xs text-neutral-500 break-all leading-relaxed">
                {error.message || 'Unknown error.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="flex-1 bg-neutral-200 text-black hover:bg-white text-xs font-medium py-2 rounded transition-colors duration-150"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium py-2 rounded transition-colors duration-150"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

