'use client';

import { useEffect, useState } from 'react';
import { getLiveErrorDetailsAction, type EngineerErrorDetails } from '@/lib/errors/engineer';

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [engDetails, setEngDetails] = useState<EngineerErrorDetails | null>(null);

  useEffect(() => {
    console.error('[AppRouteError]', error);
    void getLiveErrorDetailsAction(error?.digest || null)
      .then((details) => {
        if (details.canSeeLiveErrors) {
          setEngDetails(details);
        }
      })
      .catch(() => {});
  }, [error]);

  const rawMessage = error?.message || 'An unexpected error occurred.';
  const isMasked = rawMessage.includes('Server Components render') || rawMessage.includes('omitted in production');

  const displayMessage = engDetails?.message
    ? engDetails.message
    : isMasked
    ? 'An unexpected error occurred.'
    : rawMessage;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
      <div className="max-w-md w-full flex flex-col items-center gap-4 bg-[#141210] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg">
          !
        </div>
        <div className="flex flex-col gap-1 text-center w-full">
          <h2 className="text-base font-bold text-white font-clash">
            {engDetails?.canSeeLiveErrors ? 'Something went wrong (Engineer View)' : 'Something went wrong'}
          </h2>
          <p className="text-xs text-rose-400 font-mono break-all leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5 mt-1">
            {displayMessage}
          </p>
          {engDetails?.stack ? (
            <pre className="text-[10px] text-neutral-400 font-mono text-left max-h-32 overflow-y-auto whitespace-pre-wrap break-all bg-black/60 p-2 rounded border border-white/5 mt-1">
              {engDetails.stack}
            </pre>
          ) : null}
        </div>
        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
