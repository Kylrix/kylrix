'use client';

import { useEffect } from 'react';

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppRouteError]', error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
      <div className="max-w-md w-full flex flex-col items-center gap-4 bg-[#141210] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg">
          !
        </div>
        <div className="flex flex-col gap-1 text-center">
          <h2 className="text-base font-bold text-white font-clash">Something went wrong</h2>
          <p className="text-xs text-white/50 font-satoshi">{error?.message || 'An unexpected error occurred.'}</p>
        </div>
        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-95 transition-all"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs active:scale-95 transition-all"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}