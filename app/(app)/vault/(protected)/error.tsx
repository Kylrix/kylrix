'use client';

import { useEffect, useState } from 'react';
import { getLiveErrorDetailsAction, type EngineerErrorDetails } from '@/lib/errors/engineer';

export default function VaultError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [engDetails, setEngDetails] = useState<EngineerErrorDetails | null>(null);

  useEffect(() => {
    console.error('[Vault] Next.js Route Error Boundary caught error:', error);
    void getLiveErrorDetailsAction(error?.digest || null)
      .then((details) => {
        if (details.canSeeLiveErrors) {
          setEngDetails(details);
        }
      })
      .catch(() => {});
  }, [error]);

  const rawMessage = error?.message || String(error);
  const isMasked = rawMessage.includes('Server Components render') || rawMessage.includes('omitted in production');

  const displayMessage = engDetails?.message
    ? engDetails.message
    : isMasked
    ? 'An unexpected error occurred loading Vault.'
    : rawMessage;

  return (
    <div className="p-8 rounded-3xl bg-[#161412] border border-red-500/30 max-w-xl mx-auto my-12 text-center shadow-2xl">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl font-bold font-mono">
        !
      </div>
      <h3 className="text-lg font-black text-white font-clash mb-2">
        {engDetails?.canSeeLiveErrors ? 'Vault Render Error (Engineer View)' : 'Vault Render Error'}
      </h3>
      <p className="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded-xl border border-red-900/50 mb-6 text-left break-all">
        {displayMessage}
      </p>
      {engDetails?.stack ? (
        <pre className="text-[10px] text-neutral-400 font-mono text-left max-h-32 overflow-y-auto whitespace-pre-wrap break-all bg-black/60 p-3 rounded-xl border border-red-900/30 mb-6">
          {engDetails.stack}
        </pre>
      ) : null}
      <button
        onClick={() => reset()}
        className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs transition-colors cursor-pointer"
      >
        Retry Loading Vault
      </button>
    </div>
  );
}
